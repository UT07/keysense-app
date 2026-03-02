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
import {
  createToonMaterial,
  createBlushMaterial,
  createHiddenMaterial,
  createOutlineMaterial,
} from './ghibliMaterials';
import { splitMeshByBones } from './splitMeshByBones';

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

/**
 * Apply per-cat Ghibli toon materials to a GLTF scene clone.
 *
 * Material matching strategy (tries in order):
 *   1. Match by material.name using MATERIAL_NAME_MAP → toon materials (salsa-cat, chonky-cat)
 *   2. Split by bone weights → toon materials (slim-cat, round-cat with no named materials)
 *
 * Also adds outline meshes for the anime ink-line look.
 */
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
        const hidden = createHiddenMaterial();
        if (Array.isArray(node.material)) {
          node.material[i] = hidden;
        } else {
          node.material = hidden;
        }
        anyMaterialMatched = true;
        continue;
      }

      const colorHex = materials[materialKey];
      if (!colorHex) continue;

      // Replace with Ghibli toon material
      const toonMat = materialKey === 'blush'
        ? createBlushMaterial(colorHex)
        : createToonMaterial(colorHex, materialKey);

      if (Array.isArray(node.material)) {
        node.material[i] = toonMat;
      } else {
        node.material = toonMat;
      }
      anyMaterialMatched = true;
    }
  });

  // Fallback for single-mesh models with no named materials (slim-cat, round-cat).
  // Split geometry into material groups using bone weights, then apply toon materials.
  if (!anyMaterialMatched) {
    scene.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;

      const toonMaterials = splitMeshByBones(node, materials, hasBlush);
      if (toonMaterials) {
        node.material = toonMaterials;
      } else {
        // Ultimate fallback: single toon material
        node.material = createToonMaterial(materials.body, 'body');
      }
    });
  }
}

/**
 * Add outline meshes (inverted hull method) for Ghibli ink-line look.
 * Creates a duplicate mesh rendered with BackSide in dark color, slightly scaled up.
 */
function addOutlineMeshes(scene: THREE.Group, accentColor: string): void {
  const outlineMat = createOutlineMaterial(accentColor);
  const meshesToOutline: THREE.Mesh[] = [];

  scene.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      meshesToOutline.push(node);
    }
  });

  for (const mesh of meshesToOutline) {
    const outlineMesh = mesh.clone();
    outlineMesh.material = outlineMat;
    // Scale up slightly for outline thickness
    outlineMesh.scale.multiplyScalar(1.03);
    outlineMesh.name = `${mesh.name}_outline`;
    // Render outline behind the main mesh
    outlineMesh.renderOrder = -1;
    mesh.parent?.add(outlineMesh);
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
  const { scene: originalScene, animations } = gltf;

  // Clone the scene for this instance so each cat has independent materials.
  // useGLTF caches by URL — without cloning, all cats with the same bodyType
  // would share one scene and the last cat's colors would "win".
  const scene = useMemo(() => {
    const cloned = originalScene.clone(true);
    applyMaterials(cloned, config.materials, config.hasBlush);
    addOutlineMeshes(cloned, config.materials.accent);
    return cloned;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalScene, config.materials.body, config.materials.eye, config.materials.accent, config.hasBlush]);

  // BUG-3 & BUG-4: Dispose cloned scene's geometry AND materials on unmount
  // or when the scene is re-created. Without this, cloned materials leak GPU memory.
  useEffect(() => {
    return () => {
      scene.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.geometry?.dispose();
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          for (const mat of mats) {
            mat?.dispose();
          }
        }
      });
    };
  }, [scene]);

  // Use hardcoded scale — all 4 GLB models are ~5.4 Blender units tall.
  // Camera at z=3.5, FOV 50° sees ~3.26 units. Scale 0.5 → model ~2.7 units → fills view nicely.
  const MODEL_HEIGHT = 5.4;
  const HARDCODED_SCALE = 0.50;
  const HARDCODED_Y_OFFSET = -1.35;

  // Set up animation mixer — works on cloned scene because bone names are preserved
  const { actions, mixer } = useAnimations(animations, groupRef);

  // BUG-5: drei's useAnimations calls stopAllAction + uncacheAction on clip change,
  // but never uncacheRoot on unmount. This retains internal references to the
  // Three.js group tree. Explicitly uncache the root to allow full GC.
  useEffect(() => {
    return () => {
      mixer.stopAllAction();
      if (groupRef.current) {
        mixer.uncacheRoot(groupRef.current);
      }
    };
     
  }, [mixer]);

  // Play the correct animation for the current pose.
  // Animation naming varies across GLB exports:
  //   salsa-cat:  "Idle", "Celebrate" (no prefix)
  //   slim-cat:   "Slim_Idle" + "Idle" (both)
  //   round-cat:  "Round_Idle"
  //   chonky-cat: "Chonk_Idle"
  // We try multiple patterns to find a match.
  useEffect(() => {
    const animName = getAnimationName(config.bodyType, pose);
    const poseCapitalized = pose.charAt(0).toUpperCase() + pose.slice(1);

    // Try in order: Prefix_Pose_Track → Prefix_Pose → Pose (unprefixed)
    let action = actions[animName] ?? null;

    if (!action) {
      const altName = animName.replace('_Track', '');
      action = actions[altName] ?? null;
    }

    if (!action) {
      // Unprefixed name (e.g. "Idle", "Celebrate") — used by salsa-cat
      action = actions[poseCapitalized] ?? null;
    }

    if (!action) {
      // Fall back to idle with the same fallback chain
      const idleName = getAnimationName(config.bodyType, 'idle');
      const keys = Object.keys(actions);
      action = actions[idleName]
        ?? actions[idleName.replace('_Track', '')]
        ?? actions['Idle']
        ?? (keys.length > 0 ? actions[keys[0]] : null)
        ?? null;
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
