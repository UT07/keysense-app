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
  /** User-equipped accessory render names (from settingsStore via getEquippedRenderNames) */
  equippedRenderNames?: string[];
}

/** Convert hex color string to Three.js Color */
function hexToColor(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

/**
 * Material name → config property mapping.
 * GLB models use different naming conventions depending on how they were exported:
 *   - salsa-cat: Mat_Body, Mat_Belly, Mat_EarInner, Mat_Iris, Mat_Nose, Mat_Blush
 *   - chonky-cat: Body, Belly, Ear_Inner_L, Eye_Iris_L, Nose, Blush_L
 *   - slim/round: No materials (single uncolored mesh)
 */
const MATERIAL_NAME_MAP: Record<string, keyof Cat3DMaterials> = {
  // salsa-cat format (Mat_ prefix, shared per side)
  'Mat_Body': 'body',
  'Mat_Belly': 'belly',
  'Mat_EarInner': 'earInner',
  'Mat_Iris': 'eye',
  'Mat_Nose': 'nose',
  'Mat_Blush': 'blush',
  // chonky-cat format (no prefix, separate per side)
  'Body': 'body',
  'Belly': 'belly',
  'Ear_Inner_L': 'earInner',
  'Ear_Inner_R': 'earInner',
  'Eye_Iris_L': 'eye',
  'Eye_Iris_R': 'eye',
  'Nose': 'nose',
  'Blush_L': 'blush',
  'Blush_R': 'blush',
};

const BLUSH_MATERIAL_NAMES = new Set([
  'Mat_Blush', 'Blush_L', 'Blush_R',
]);

/** Apply per-cat colors to the loaded GLTF scene */
function applyMaterials(scene: THREE.Group, materials: Cat3DMaterials, hasBlush: boolean): void {
  let anyMaterialMatched = false;

  scene.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;

    // Handle multi-material meshes (material array) and single-material meshes
    const nodeMaterials = Array.isArray(node.material) ? node.material : [node.material];

    for (let i = 0; i < nodeMaterials.length; i++) {
      const mat = nodeMaterials[i];
      if (!mat || !mat.name) continue;

      const materialKey = MATERIAL_NAME_MAP[mat.name];
      if (!materialKey) continue;

      // Hide blush materials if cat doesn't have blush
      if (BLUSH_MATERIAL_NAMES.has(mat.name) && !hasBlush) {
        if (mat instanceof THREE.MeshStandardMaterial) {
          const cloned = mat.clone();
          cloned.transparent = true;
          cloned.opacity = 0;
          if (Array.isArray(node.material)) {
            node.material[i] = cloned;
          } else {
            node.material = cloned;
          }
        }
        anyMaterialMatched = true;
        continue;
      }

      const colorHex = materials[materialKey];
      if (!colorHex) continue;

      // Clone material to avoid affecting other instances
      if (mat instanceof THREE.MeshStandardMaterial) {
        const cloned = mat.clone();
        const color = hexToColor(colorHex);
        cloned.color = color;

        // Per-part material properties for expressive anime look
        if (materialKey === 'eye') {
          // Eyes: bright, wet, glossy with strong catchlight
          cloned.roughness = 0.05;
          cloned.metalness = 0.15;
          cloned.emissive = color;
          cloned.emissiveIntensity = 0.25;
        } else if (materialKey === 'nose') {
          // Nose: wet, shiny
          cloned.roughness = 0.1;
          cloned.metalness = 0.25;
          cloned.emissive = color;
          cloned.emissiveIntensity = 0.1;
        } else if (materialKey === 'blush') {
          // Blush: soft, warm glow
          cloned.roughness = 0.4;
          cloned.metalness = 0.0;
          cloned.emissive = color;
          cloned.emissiveIntensity = 0.2;
          cloned.transparent = true;
          cloned.opacity = 0.7;
        } else {
          // Body/belly/earInner: glossy vinyl toy look
          cloned.roughness = 0.2;
          cloned.metalness = 0.08;
          cloned.emissive = color;
          cloned.emissiveIntensity = 0.08;
        }

        if (Array.isArray(node.material)) {
          node.material[i] = cloned;
        } else {
          node.material = cloned;
        }
        anyMaterialMatched = true;
      }
    }
  });

  // Fallback for models with no named materials (slim-cat, round-cat):
  // Apply per-part colors based on mesh node names
  if (!anyMaterialMatched) {
    const bodyColor = hexToColor(materials.body);
    const bellyColor = hexToColor(materials.belly);
    const eyeColor = hexToColor(materials.eye);
    const noseColor = materials.nose ? hexToColor(materials.nose) : bodyColor;

    scene.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;

      const name = node.name.toLowerCase();
      let color = bodyColor;
      let roughness = 0.2;
      let metalness = 0.08;
      let emissiveIntensity = 0.08;

      if (name.includes('eye') || name.includes('iris')) {
        color = eyeColor;
        roughness = 0.05;
        metalness = 0.15;
        emissiveIntensity = 0.25;
      } else if (name.includes('nose')) {
        color = noseColor;
        roughness = 0.1;
        metalness = 0.25;
        emissiveIntensity = 0.1;
      } else if (name.includes('belly') || name.includes('chest')) {
        color = bellyColor;
      }

      const newMat = new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness,
        emissive: color,
        emissiveIntensity,
      });
      node.material = newMat;
    });
  }
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
  equippedRenderNames = [],
}: CatModel3DProps) {
  const config = getCat3DConfig(catId);
  const evolutionAccessoryProps = getAccessoryProps(catId, evolutionStage);
  const modelAssetId = MODEL_PATHS[config.bodyType];

  // Merge evolution-stage accessories with user-equipped accessories
  const mergedAccessoryProps = useMemo(() => {
    const evolutionNames = evolutionAccessoryProps?.accessories ?? [];
    const allNames = [...new Set([...evolutionNames, ...equippedRenderNames])];
    if (allNames.length === 0) return null;
    return {
      accessories: allNames,
      accentColor: evolutionAccessoryProps?.accentColor ?? config.materials.accent,
      hasGlow: evolutionAccessoryProps?.hasGlow ?? false,
      auraIntensity: evolutionAccessoryProps?.auraIntensity ?? 0,
    };
  }, [evolutionAccessoryProps, equippedRenderNames, config.materials.accent]);

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
    accessoryProps={mergedAccessoryProps}
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

  // Apply materials to the original scene (clone caused bounding box issues on device).
  // Use hardcoded scale — all 4 GLB models are ~5.4 Blender units tall.
  // Camera at z=3.5, FOV 50° sees ~3.26 units. Scale 0.5 → model ~2.7 units → fills view nicely.
  const MODEL_HEIGHT = 5.4;        // All GLBs are ~5.4 Blender units tall
  const HARDCODED_SCALE = 0.50;    // Large, prominent cat
  const HARDCODED_Y_OFFSET = -1.35; // -MODEL_HEIGHT/2 * 0.50 = -1.35 (centers model vertically)

  useMemo(() => {
    applyMaterials(scene, config.materials, config.hasBlush);
    console.log(`[CatModel3D] Rendering with hardcoded scale=${HARDCODED_SCALE}, yOffset=${HARDCODED_Y_OFFSET}`);
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

  // Simple transform: scale down, center vertically, no bounding box magic.
  // The group nesting keeps animation ref separate from positioning.
  // Accessories go INSIDE the same scale/offset group so they align with the model.
  return (
    <group ref={groupRef} dispose={null}>
      <group
        scale={[HARDCODED_SCALE * scale, HARDCODED_SCALE * scale, HARDCODED_SCALE * scale]}
        position={[0, HARDCODED_Y_OFFSET * scale, 0]}
      >
        <primitive object={scene} />
        {/* Accessories were designed for a normalized 0-1 unit model.
            Scale by MODEL_HEIGHT so their coordinates align with the actual GLB body. */}
        {accessoryProps && (
          <group scale={[MODEL_HEIGHT, MODEL_HEIGHT, MODEL_HEIGHT]}>
            <CatAccessories3D
              accessories={accessoryProps.accessories}
              accentColor={accessoryProps.accentColor}
              hasGlow={accessoryProps.hasGlow}
              auraIntensity={accessoryProps.auraIntensity}
            />
          </group>
        )}
      </group>
    </group>
  );
}
