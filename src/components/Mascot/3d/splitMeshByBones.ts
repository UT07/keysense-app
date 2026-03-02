/**
 * Bone-Weight Mesh Splitter
 *
 * For GLB models exported without per-part materials (slim-cat, round-cat),
 * this utility splits a single-mesh skinned model into material groups
 * based on bone weights. Each face is assigned to a material based on
 * which bone most strongly influences its vertices.
 *
 * The result is geometry.groups + a material array, enabling multi-material
 * rendering on what was originally a single-material mesh.
 */

import * as THREE from 'three';
import type { Cat3DMaterials } from './cat3DConfig';
import {
  createToonMaterial,
  createBlushMaterial,
  createHiddenMaterial,
} from './ghibliMaterials';

// ────────────────────────────────────────────────
// Bone → Material Part mapping
// Maps bone names (from armature) to Cat3DMaterials keys.
// The bone hierarchy in slim/round cats:
//   Ear_L(0), Eye_L(1), Ear_R(2), Eye_R(3), Head(4),
//   Neck(5), Chest(6), Leg_FL(7), Leg_FR(8), Leg_BL(9),
//   Leg_BR(10), Tail_3(11), Tail_2(12), Tail_1(13),
//   Spine(14), Root(15)
// ────────────────────────────────────────────────

/** Material indices in the output material array */
export const MAT_BODY = 0;
export const MAT_BELLY = 1;
export const MAT_EAR_INNER = 2;
export const MAT_EYE = 3;
export const MAT_NOSE = 4;
export const MAT_BLUSH = 5;

/**
 * Map bone name → material index.
 * Used for both slim-cat and round-cat armatures.
 */
const BONE_NAME_TO_MAT: Record<string, number> = {
  'Ear_L': MAT_EAR_INNER,
  'Ear_R': MAT_EAR_INNER,
  'Eye_L': MAT_EYE,
  'Eye_R': MAT_EYE,
  'Head': MAT_BODY,      // Head body color
  'Neck': MAT_BODY,
  'Chest': MAT_BELLY,    // Chest/belly area
  'Leg_FL': MAT_BODY,
  'Leg_FR': MAT_BODY,
  'Leg_BL': MAT_BODY,
  'Leg_BR': MAT_BODY,
  'Tail_1': MAT_BODY,
  'Tail_2': MAT_BODY,
  'Tail_3': MAT_BODY,
  'Spine': MAT_BODY,
  'Root': MAT_BODY,
  'neutral_bone': MAT_BODY,
};

/**
 * Build a bone index → material index lookup from the skeleton.
 */
function buildBoneToMaterialMap(skeleton: THREE.Skeleton): number[] {
  const map: number[] = [];
  for (let i = 0; i < skeleton.bones.length; i++) {
    const boneName = skeleton.bones[i].name;
    map[i] = BONE_NAME_TO_MAT[boneName] ?? MAT_BODY;
  }
  return map;
}

/**
 * Get the dominant bone index for a vertex (highest weight).
 */
function getDominantBone(
  skinIndex: THREE.BufferAttribute,
  skinWeight: THREE.BufferAttribute,
  vertexIndex: number,
): number {
  let maxWeight = -1;
  let maxBone = 0;

  // skinIndex/skinWeight store 4 bone influences per vertex
  const ix = skinIndex.getX(vertexIndex);
  const iy = skinIndex.getY(vertexIndex);
  const iz = skinIndex.getZ(vertexIndex);
  const iw = skinIndex.getW(vertexIndex);
  const wx = skinWeight.getX(vertexIndex);
  const wy = skinWeight.getY(vertexIndex);
  const wz = skinWeight.getZ(vertexIndex);
  const ww = skinWeight.getW(vertexIndex);

  if (wx > maxWeight) { maxWeight = wx; maxBone = ix; }
  if (wy > maxWeight) { maxWeight = wy; maxBone = iy; }
  if (wz > maxWeight) { maxWeight = wz; maxBone = iz; }
  if (ww > maxWeight) { maxWeight = ww; maxBone = iw; }

  return maxBone;
}

/**
 * Split a skinned mesh into material groups based on bone weights.
 *
 * Modifies the geometry's index buffer (reorders faces) and adds
 * geometry.groups for multi-material rendering. Returns the material
 * array to assign to mesh.material.
 *
 * @returns Array of materials matching the geometry groups, or null
 *          if the mesh has no skinning data.
 */
export function splitMeshByBones(
  mesh: THREE.SkinnedMesh | THREE.Mesh,
  materials: Cat3DMaterials,
  hasBlush: boolean,
): THREE.Material[] | null {
  const geometry = mesh.geometry;
  const skinIndex = geometry.attributes.skinIndex as THREE.BufferAttribute | undefined;
  const skinWeight = geometry.attributes.skinWeight as THREE.BufferAttribute | undefined;
  const index = geometry.index;

  if (!skinIndex || !skinWeight || !index) {
    return null;
  }

  // Get skeleton for bone name mapping
  let boneToMat: number[];
  if (mesh instanceof THREE.SkinnedMesh && mesh.skeleton) {
    boneToMat = buildBoneToMaterialMap(mesh.skeleton);
  } else {
    // Fallback: assume standard bone order
    boneToMat = [
      MAT_EAR_INNER, MAT_EYE, MAT_EAR_INNER, MAT_EYE,  // Ear_L, Eye_L, Ear_R, Eye_R
      MAT_BODY, MAT_BODY, MAT_BELLY,                      // Head, Neck, Chest
      MAT_BODY, MAT_BODY, MAT_BODY, MAT_BODY,            // Legs
      MAT_BODY, MAT_BODY, MAT_BODY,                       // Tails
      MAT_BODY, MAT_BODY,                                  // Spine, Root
    ];
  }

  // Step 1: Classify each face by material group
  const faceCount = index.count / 3;
  const faceMaterials = new Uint8Array(faceCount);

  for (let f = 0; f < faceCount; f++) {
    const i0 = index.getX(f * 3);
    const i1 = index.getX(f * 3 + 1);
    const i2 = index.getX(f * 3 + 2);

    // Get dominant bone for each vertex
    const bone0 = getDominantBone(skinIndex, skinWeight, i0);
    const bone1 = getDominantBone(skinIndex, skinWeight, i1);
    const bone2 = getDominantBone(skinIndex, skinWeight, i2);

    // Majority vote for face material
    const mat0 = boneToMat[bone0] ?? MAT_BODY;
    const mat1 = boneToMat[bone1] ?? MAT_BODY;
    const mat2 = boneToMat[bone2] ?? MAT_BODY;

    // Simple majority: if 2 or more vertices agree, use that material
    if (mat0 === mat1 || mat0 === mat2) {
      faceMaterials[f] = mat0;
    } else if (mat1 === mat2) {
      faceMaterials[f] = mat1;
    } else {
      faceMaterials[f] = mat0; // No majority, use first vertex
    }
  }

  // Step 2: Sort faces by material group and rebuild index buffer
  const sortedFaceIndices = Array.from({ length: faceCount }, (_, i) => i);
  sortedFaceIndices.sort((a, b) => faceMaterials[a] - faceMaterials[b]);

  const newIndices = new Uint16Array(index.count);
  for (let i = 0; i < faceCount; i++) {
    const origFace = sortedFaceIndices[i];
    newIndices[i * 3] = index.getX(origFace * 3);
    newIndices[i * 3 + 1] = index.getX(origFace * 3 + 1);
    newIndices[i * 3 + 2] = index.getX(origFace * 3 + 2);
  }

  // Replace index buffer
  geometry.setIndex(new THREE.BufferAttribute(newIndices, 1));

  // Step 3: Define geometry groups (contiguous face ranges per material)
  geometry.clearGroups();
  let groupStart = 0;
  let currentMat = faceMaterials[sortedFaceIndices[0]];

  for (let i = 1; i <= faceCount; i++) {
    const mat = i < faceCount ? faceMaterials[sortedFaceIndices[i]] : -1;
    if (mat !== currentMat) {
      const count = (i - groupStart) * 3;
      geometry.addGroup(groupStart * 3, count, currentMat);
      groupStart = i;
      currentMat = mat;
    }
  }

  // Step 4: Create material array
  const materialArray: THREE.Material[] = [
    createToonMaterial(materials.body, 'body'),         // 0: body
    createToonMaterial(materials.belly, 'belly'),       // 1: belly
    createToonMaterial(materials.earInner, 'earInner'), // 2: earInner
    createToonMaterial(materials.eye, 'eye'),           // 3: eye
    createToonMaterial(materials.nose, 'nose'),         // 4: nose (unused for bone-split, but reserved)
    hasBlush && materials.blush
      ? createBlushMaterial(materials.blush)            // 5: blush
      : createHiddenMaterial(),
  ];

  return materialArray;
}
