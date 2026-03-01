/**
 * CatModel3D - Three.js GLB cat model renderer
 *
 * Loads a body-type-specific .glb model, applies per-cat material colors,
 * and plays pose-driven skeletal animations. Falls back to SVG CatAvatar
 * if the 3D context fails to initialize.
 */

import { useRef, useEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber/native';
import { useGLTF, useAnimations } from '@react-three/drei/native';
import * as THREE from 'three';
import { Asset } from 'expo-asset';

import type { CatPose } from '../animations/catAnimations';
import type { EvolutionStage } from '@/stores/types';
import { getCat3DConfig, getAnimationName, MODEL_PATHS } from './cat3DConfig';
import { getAccessoryProps } from './cat3DConfig';
import type { Cat3DMaterials, Cat3DConfig } from './cat3DConfig';
import { CatAccessories3D } from './CatAccessories3D';

// ────────────────────────────────────────────────
// Asset resolution cache: Metro asset ID → file:// URI
// ────────────────────────────────────────────────
const resolvedUriCache = new Map<number, string>();

async function resolveAssetUri(assetId: number): Promise<string> {
  const cached = resolvedUriCache.get(assetId);
  if (cached) return cached;

  const asset = Asset.fromModule(assetId);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  resolvedUriCache.set(assetId, uri);
  return uri;
}

interface CatModel3DProps {
  catId: string;
  pose?: CatPose;
  /** Scale multiplier (default 1) */
  scale?: number;
  /** Gentle floating idle animation */
  enableIdle?: boolean;
  /** Evolution stage for accessory rendering */
  evolutionStage?: EvolutionStage;
}

/** Convert hex color string to Three.js Color */
function hexToColor(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

/**
 * Mesh name → material property mapping.
 * GLB meshes are named by convention during Blender export.
 */
const MESH_MATERIAL_MAP: Record<string, keyof Cat3DMaterials> = {
  Body: 'body',
  Belly: 'belly',
  'Ear_Inner_L': 'earInner',
  'Ear_Inner_R': 'earInner',
  'Eye_Iris_L': 'eye',
  'Eye_Iris_R': 'eye',
  Nose: 'nose',
  'Blush_L': 'blush',
  'Blush_R': 'blush',
};

/** Apply per-cat colors to the loaded GLTF scene */
function applyMaterials(scene: THREE.Group, materials: Cat3DMaterials, hasBlush: boolean): void {
  scene.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;

    const materialKey = MESH_MATERIAL_MAP[node.name];
    if (!materialKey) return;

    // Hide blush meshes if cat doesn't have blush
    if ((node.name === 'Blush_L' || node.name === 'Blush_R') && !hasBlush) {
      node.visible = false;
      return;
    }

    const colorHex = materials[materialKey];
    if (!colorHex) return;

    // Clone material to avoid affecting other instances
    if (node.material instanceof THREE.MeshStandardMaterial) {
      node.material = node.material.clone();
      node.material.color = hexToColor(colorHex);
    }
  });
}

/** Idle floating animation (gentle sine-wave bob) */
function useIdleFloat(groupRef: React.RefObject<THREE.Group | null>, enabled: boolean) {
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    if (!enabled || !groupRef.current) return;
    timeRef.current += delta;
    groupRef.current.position.y = Math.sin(timeRef.current * 1.2) * 0.05;
    groupRef.current.rotation.y = Math.sin(timeRef.current * 0.5) * 0.03;
  });
}

export function CatModel3D({
  catId,
  pose = 'idle',
  scale = 1,
  enableIdle = true,
  evolutionStage = 'baby',
}: CatModel3DProps) {
  const config = getCat3DConfig(catId);
  const accessoryProps = getAccessoryProps(catId, evolutionStage);
  const modelAssetId = MODEL_PATHS[config.bodyType];

  // Resolve Metro asset ID → file:// URI before passing to useGLTF
  const [modelUri, setModelUri] = useState<string | null>(null);
  useEffect(() => {
    resolveAssetUri(modelAssetId).then(setModelUri).catch((err) => {
      console.warn('[CatModel3D] Failed to resolve asset URI:', err);
    });
  }, [modelAssetId]);

  // Don't render until URI is resolved
  if (!modelUri) return null;

  return <CatModel3DInner
    modelUri={modelUri}
    config={config}
    pose={pose}
    scale={scale}
    enableIdle={enableIdle}
    accessoryProps={accessoryProps}
  />;
}

/** Inner component that renders once the model URI is resolved */
function CatModel3DInner({
  modelUri,
  config,
  pose,
  scale,
  enableIdle,
  accessoryProps,
}: {
  modelUri: string;
  config: Cat3DConfig;
  pose: CatPose;
  scale: number;
  enableIdle: boolean;
  accessoryProps: ReturnType<typeof getAccessoryProps>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const gltf = useGLTF(modelUri);
  const { scene, animations } = gltf;

  // Clone the scene so each cat instance gets its own materials
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    applyMaterials(clone, config.materials, config.hasBlush);
    return clone;
  }, [scene, config.materials, config.hasBlush]);

  // Set up animation mixer
  const { actions } = useAnimations(animations, groupRef);

  // Play the correct animation for the current pose
  useEffect(() => {
    const animName = getAnimationName(config.bodyType, pose);

    // Try exact name first, then fall back to any matching animation
    let action = actions[animName] ?? null;

    if (!action) {
      // Try without the _Track suffix
      const altName = animName.replace('_Track', '');
      action = actions[altName] ?? null;
    }

    if (!action) {
      // Fall back to idle
      const idleName = getAnimationName(config.bodyType, 'idle');
      const keys = Object.keys(actions);
      action = actions[idleName] ?? (keys.length > 0 ? actions[keys[0]] : null) ?? null;
    }

    if (action) {
      // Crossfade to new animation
      action.reset().fadeIn(0.3).play();
      return () => {
        action!.fadeOut(0.3);
      };
    }
    return undefined;
  }, [pose, config.bodyType, actions]);

  // Idle floating bob
  useIdleFloat(groupRef, enableIdle && pose === 'idle');

  return (
    <group ref={groupRef} scale={scale} dispose={null}>
      <primitive object={clonedScene} />
      {accessoryProps && (
        <CatAccessories3D
          accessories={accessoryProps.accessories}
          accentColor={accessoryProps.accentColor}
          hasGlow={accessoryProps.hasGlow}
          auraIntensity={accessoryProps.auraIntensity}
        />
      )}
    </group>
  );
}
