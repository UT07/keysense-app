/**
 * Ghibli-Style Material System for 3D Cat Models
 *
 * Creates Studio Ghibli-inspired toon materials with:
 * - 3-band cel shading (highlight → midtone → shadow)
 * - Warm shadow tones
 * - Soft specular highlights
 * - Rim light sensitivity
 *
 * Uses THREE.MeshToonMaterial with a custom gradient map DataTexture.
 */

import * as THREE from 'three';
import type { Cat3DMaterials } from './cat3DConfig';

// ────────────────────────────────────────────────
// Gradient map for toon shading bands
// ────────────────────────────────────────────────

/** 4-pixel gradient: deep shadow → shadow → midtone → highlight */
const GRADIENT_PIXELS = new Uint8Array([
  80,   // 0.00-0.25: deep shadow (31%)
  140,  // 0.25-0.50: shadow (55%)
  210,  // 0.50-0.75: midtone (82%)
  255,  // 0.75-1.00: highlight (100%)
]);

let _gradientMap: THREE.DataTexture | null = null;

/** Get shared toon gradient map (created once, reused) */
export function getToonGradientMap(): THREE.DataTexture {
  if (!_gradientMap) {
    _gradientMap = new THREE.DataTexture(GRADIENT_PIXELS, 4, 1, THREE.RedFormat);
    _gradientMap.minFilter = THREE.NearestFilter;
    _gradientMap.magFilter = THREE.NearestFilter;
    _gradientMap.needsUpdate = true;
  }
  return _gradientMap;
}

// ────────────────────────────────────────────────
// Per-part material properties
// ────────────────────────────────────────────────

interface ToonPartProps {
  emissiveIntensity: number;
  /** If true, uses MeshStandardMaterial (glossy) instead of toon */
  glossy?: boolean;
}

const PART_PROPS: Record<string, ToonPartProps> = {
  body:     { emissiveIntensity: 0.06 },
  belly:    { emissiveIntensity: 0.04 },
  earInner: { emissiveIntensity: 0.10 },
  eye:      { emissiveIntensity: 0.30, glossy: true },
  nose:     { emissiveIntensity: 0.08 },
  blush:    { emissiveIntensity: 0.15 },
  accent:   { emissiveIntensity: 0.12 },
};

/**
 * Create a Ghibli-style toon material for a specific cat body part.
 */
export function createToonMaterial(
  colorHex: string,
  partKey: keyof Cat3DMaterials,
): THREE.Material {
  const color = new THREE.Color(colorHex);
  const props = PART_PROPS[partKey] ?? { emissiveIntensity: 0.05 };

  if (props.glossy) {
    // Eyes get a glossy standard material for sparkle/depth
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.05,
      metalness: 0.0,
      emissive: color,
      emissiveIntensity: props.emissiveIntensity,
    });
  }

  // Warm emissive: shift color towards warm orange for shadow fill
  const warmEmissive = color.clone().lerp(new THREE.Color('#FFE0C0'), 0.3);

  return new THREE.MeshToonMaterial({
    color,
    gradientMap: getToonGradientMap(),
    emissive: warmEmissive,
    emissiveIntensity: props.emissiveIntensity,
  });
}

/**
 * Create a blush material (translucent toon).
 */
export function createBlushMaterial(colorHex: string): THREE.Material {
  const color = new THREE.Color(colorHex);

  return new THREE.MeshToonMaterial({
    color,
    gradientMap: getToonGradientMap(),
    emissive: color,
    emissiveIntensity: 0.15,
    transparent: true,
    opacity: 0.6,
  });
}

/**
 * Create a hidden material (for parts that should be invisible).
 */
export function createHiddenMaterial(): THREE.Material {
  return new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
}

/**
 * Create an outline material (inverted hull method).
 * Renders back faces slightly scaled up in solid dark color.
 */
export function createOutlineMaterial(accentHex: string): THREE.MeshBasicMaterial {
  // Dark outline tinted towards the cat's accent color
  const outlineColor = new THREE.Color(accentHex).multiplyScalar(0.15);

  return new THREE.MeshBasicMaterial({
    color: outlineColor,
    side: THREE.BackSide,
  });
}

/**
 * Create the full set of toon materials for a cat, keyed by part name.
 */
export function createCatToonMaterials(
  materials: Cat3DMaterials,
  hasBlush: boolean,
): Map<keyof Cat3DMaterials, THREE.Material> {
  const result = new Map<keyof Cat3DMaterials, THREE.Material>();

  result.set('body', createToonMaterial(materials.body, 'body'));
  result.set('belly', createToonMaterial(materials.belly, 'belly'));
  result.set('earInner', createToonMaterial(materials.earInner, 'earInner'));
  result.set('eye', createToonMaterial(materials.eye, 'eye'));
  result.set('nose', createToonMaterial(materials.nose, 'nose'));
  result.set('accent', createToonMaterial(materials.accent, 'accent'));

  if (hasBlush && materials.blush) {
    result.set('blush', createBlushMaterial(materials.blush));
  }

  return result;
}
