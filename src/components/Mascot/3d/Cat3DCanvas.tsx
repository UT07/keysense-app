/**
 * Cat3DCanvas - Self-contained 3D cat viewer
 *
 * Wraps CatModel3D in a Three.js Canvas with camera, lighting, and error
 * boundary. Falls back to the existing SVG CatAvatar if 3D rendering fails.
 *
 * Usage:
 *   <Cat3DCanvas catId="jazzy" size={120} pose="celebrate" />
 *
 * Performance notes:
 * - ONE 3D canvas per screen max (multiple canvases = multiple GL contexts)
 * - For lists, use SVG CatAvatar instead
 * - Canvas runs at 30fps to save battery
 */

import React, { Suspense, useState, useEffect, useCallback, useMemo, Component } from 'react';
import type { ReactElement, ReactNode, ErrorInfo } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';

import { CatAvatar } from '../CatAvatar';

// Safe wrapper: useIsFocused throws if not inside a NavigationContainer
// (e.g. in Jest tests or standalone overlays). Default to "focused".
let _useIsFocused: () => boolean;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  _useIsFocused = require('@react-navigation/native').useIsFocused;
} catch {
  _useIsFocused = () => true;
}
function useSafeIsFocused(): boolean {
  try { return _useIsFocused(); } catch { return true; }
}
import type { CatPose } from '../animations/catAnimations';
import type { MascotMood } from '../types';
import type { EvolutionStage } from '@/stores/types';
import { useSettingsStore } from '@/stores/settingsStore';
import { getEquippedRenderNames } from '@/data/accessories';

// ────────────────────────────────────────────────
// Dynamic imports for 3D (expo-gl may not be available)
// ────────────────────────────────────────────────
// expo-gl@15 uses TurboModules, so the old NativeModules.ExponentGLObjectManager
// check no longer works. Instead, we try to require the modules directly
// and catch any failures.

let R3FCanvas: any = null;
let CatModel3DComponent: any = null;
let gl3DAvailable = false;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('expo-gl');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  R3FCanvas = require('@react-three/fiber/native').Canvas;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  CatModel3DComponent = require('./CatModel3D').CatModel3D;
  gl3DAvailable = true;
  console.log('[Cat3DCanvas] 3D rendering available (expo-gl loaded)');
} catch (error) {
  console.log('[Cat3DCanvas] 3D not available — using SVG fallback:', (error as Error).message);
}

// ────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────

interface Cat3DCanvasProps {
  catId: string;
  /** Pixel size for the canvas container */
  size?: number;
  pose?: CatPose;
  mood?: MascotMood;
  evolutionStage?: EvolutionStage;
  /** Show SVG fallback instead of 3D */
  forceSVG?: boolean;
}

// ────────────────────────────────────────────────
// Error Boundary (class component required by React)
// ────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  onError?: (error: Error) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ThreeErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn('[Cat3DCanvas] 3D render error caught by boundary:', error.message, info.componentStack?.slice(0, 200));
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// ────────────────────────────────────────────────
// Loading timeout — GLB models need: asset resolution → download → parse → GPU upload.
// On a real device first load can take 5-8 seconds. 10s is generous but avoids
// premature SVG fallback. After first load, useGLTF caches the parsed scene.
// ────────────────────────────────────────────────

const LOAD_TIMEOUT_MS = 10000;

/** Spinner shown while GLB model loads */
function LoadingFallback({ size }: { size: number }) {
  return (
    <View style={[styles.loading, { width: size, height: size }]}>
      <ActivityIndicator size="small" color="#9B59B6" />
    </View>
  );
}

// ────────────────────────────────────────────────
// Pose → Mood mapping for SVG fallback
// ────────────────────────────────────────────────

const POSE_TO_MOOD: Record<CatPose, MascotMood> = {
  idle: 'happy',
  celebrate: 'celebrating',
  teach: 'encouraging',
  sleep: 'teaching',
  play: 'excited',
  sad: 'teaching',
  curious: 'encouraging',
};

// ────────────────────────────────────────────────
// SVG fallback renderer
// ────────────────────────────────────────────────

function SVGFallback({
  catId,
  size,
  pose,
  mood,
  evolutionStage,
}: {
  catId: string;
  size: number;
  pose: CatPose;
  mood: MascotMood;
  evolutionStage: EvolutionStage;
}): ReactElement {
  const svgMood = pose ? POSE_TO_MOOD[pose] : mood;
  const svgSize = size <= 64 ? 'small' : size <= 96 ? 'medium' : 'large';
  return (
    <CatAvatar
      catId={catId}
      size={svgSize}
      mood={svgMood}
      pose={pose}
      evolutionStage={evolutionStage}
      skipEntryAnimation
    />
  );
}

// ────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────

export const Cat3DCanvas = React.memo(function Cat3DCanvas({
  catId,
  size = 120,
  pose = 'idle',
  mood = 'happy',
  evolutionStage = 'baby',
  forceSVG = false,
}: Cat3DCanvasProps): ReactElement {
  // When screen loses focus (hidden behind another screen in the nav stack),
  // fall back to SVG to free the GL context. This prevents multiple GL contexts
  // from accumulating across stacked screens (each eats GPU memory).
  const isFocused = useSafeIsFocused();

  const [hasError, setHasError] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);

  // Read user-equipped accessories from settingsStore
  const equippedAccessories = useSettingsStore((s) => s.equippedAccessories);
  const equippedRenderNames = useMemo(
    () => getEquippedRenderNames(equippedAccessories),
    [equippedAccessories],
  );

  // Loading timeout: if 3D doesn't render within LOAD_TIMEOUT_MS, fall back to SVG
  useEffect(() => {
    if (canvasReady || hasError || forceSVG) return;

    const timer = setTimeout(() => {
      if (!canvasReady) {
        console.warn(`[Cat3DCanvas] Loading timed out after ${LOAD_TIMEOUT_MS}ms for ${catId}, falling back to SVG`);
        setTimedOut(true);
      }
    }, LOAD_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [canvasReady, hasError, forceSVG, catId]);

  const handleCanvasCreated = useCallback(() => {
    setCanvasReady(true);
  }, []);

  const handleError = useCallback((error: Error) => {
    console.warn('[Cat3DCanvas] Error:', error.message);
    setHasError(true);
  }, []);

  // Fall back to SVG if 3D unavailable, fails, times out, forced off, or screen not focused.
  // The !isFocused check is critical: React Navigation keeps background screens mounted,
  // so without this every stacked screen keeps its GL context alive (GPU exhaustion).
  if (!gl3DAvailable || !R3FCanvas || !CatModel3DComponent || forceSVG || hasError || timedOut || !isFocused) {
    return (
      <SVGFallback
        catId={catId}
        size={size}
        pose={pose}
        mood={mood}
        evolutionStage={evolutionStage}
      />
    );
  }

  const svgFallbackElement = (
    <SVGFallback
      catId={catId}
      size={size}
      pose={pose}
      mood={mood}
      evolutionStage={evolutionStage}
    />
  );

  const CanvasComponent = R3FCanvas;
  const ModelComponent = CatModel3DComponent;

  return (
    <ThreeErrorBoundary fallback={svgFallbackElement} onError={handleError}>
      <View style={[styles.container, { width: size, height: size }]}>
        <Suspense fallback={<LoadingFallback size={size} />}>
          <CanvasComponent
            frameloop="always"
            gl={{ antialias: true, alpha: true }}
            camera={{ position: [0, 0, 3.5], fov: 50 }}
            onCreated={(state: any) => {
              state.gl.setClearColor(0x000000, 0);
              handleCanvasCreated();
            }}
            style={styles.canvas}
          >
            {/* Strong ambient fill so dark models are always visible */}
            <ambientLight intensity={2.0} />
            {/* Key light — bright warm front-top */}
            <directionalLight position={[2, 3, 4]} intensity={1.5} />
            {/* Hemisphere light — sky/ground color gradient for natural fill */}
            <hemisphereLight args={['#B8C8FF', '#FFE8D0', 1.2]} />
            {/* Rim light — backlight for silhouette edge definition */}
            <directionalLight position={[-2, 1, -3]} intensity={0.8} color="#B0C4FF" />
            {/* Fill light from below for anime-style uplighting */}
            <directionalLight position={[0, -2, 2]} intensity={0.4} color="#FFE0FF" />
            {/* Front point light for extra specular highlights */}
            <pointLight position={[0, 0.5, 3]} intensity={1.0} distance={8} />

            <ModelComponent
              catId={catId}
              pose={pose}
              scale={1}
              evolutionStage={evolutionStage}
              equippedRenderNames={equippedRenderNames}
            />
          </CanvasComponent>
        </Suspense>
      </View>
    </ThreeErrorBoundary>
  );
});

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 999,
  },
  canvas: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loading: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
