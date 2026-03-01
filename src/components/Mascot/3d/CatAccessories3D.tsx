/**
 * CatAccessories3D — Programmatic Three.js accessories for evolved cats.
 *
 * Renders simple geometry accessories (bow-ties, crowns, capes, etc.) as
 * child nodes of the cat model group. Each accessory is positioned relative
 * to the cat's origin (0,0,0) which is roughly at the base/feet.
 *
 * Accessory names come from catCharacters.ts evolutionVisuals[stage].accessories.
 * Unknown names gracefully return null (no crash).
 *
 * Coordinate reference (cat model):
 *   y=0    → feet
 *   y=0.5  → belly/neck
 *   y=0.7  → head center
 *   y=0.9  → top of head
 *   z=0.15 → front face
 *   z=-0.2 → behind back
 */

import type { ReactElement } from 'react';
import * as THREE from 'three';

// ─────────────────────────────────────────────
// Shared geometry (created once, reused)
// ─────────────────────────────────────────────

const sphereGeom = new THREE.SphereGeometry(1, 12, 8);
const boxGeom = new THREE.BoxGeometry(1, 1, 1);
const torusGeom = new THREE.TorusGeometry(1, 0.15, 8, 24);
const coneGeom = new THREE.ConeGeometry(1, 1, 8);
const cylinderGeom = new THREE.CylinderGeometry(1, 1, 1, 12);

// ─────────────────────────────────────────────
// Individual accessory components
// ─────────────────────────────────────────────

function BowTie3D({ color }: { color: string }): ReactElement {
  return (
    <group position={[0, 0.48, 0.18]}>
      {/* Left wing */}
      <mesh geometry={coneGeom} position={[-0.06, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.04, 0.06, 0.03]}>
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Right wing */}
      <mesh geometry={coneGeom} position={[0.06, 0, 0]} rotation={[0, 0, -Math.PI / 2]} scale={[0.04, 0.06, 0.03]}>
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Center knot */}
      <mesh geometry={sphereGeom} scale={[0.02, 0.02, 0.02]}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

function Crown3D({ color }: { color: string }): ReactElement {
  return (
    <group position={[0, 0.92, 0]}>
      {/* Crown base ring */}
      <mesh geometry={cylinderGeom} scale={[0.12, 0.03, 0.12]}>
        <meshStandardMaterial color="#FFD700" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Crown points */}
      {[-0.06, 0, 0.06].map((x, i) => (
        <mesh key={i} geometry={coneGeom} position={[x, 0.05, 0]} scale={[0.025, 0.06, 0.025]}>
          <meshStandardMaterial color="#FFD700" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
      {/* Gem on center point */}
      <mesh geometry={sphereGeom} position={[0, 0.08, 0]} scale={[0.015, 0.015, 0.015]}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

function TinyCrown3D({ color }: { color: string }): ReactElement {
  return (
    <group position={[0.06, 0.88, 0.02]} rotation={[0, 0, 0.2]}>
      <mesh geometry={cylinderGeom} scale={[0.06, 0.02, 0.06]}>
        <meshStandardMaterial color="#FFD700" metalness={0.8} roughness={0.2} />
      </mesh>
      {[0].map((_, i) => (
        <mesh key={i} geometry={coneGeom} position={[0, 0.03, 0]} scale={[0.015, 0.04, 0.015]}>
          <meshStandardMaterial color="#FFD700" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
      <mesh geometry={sphereGeom} position={[0, 0.05, 0]} scale={[0.01, 0.01, 0.01]}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

function Tiara3D({ color }: { color: string }): ReactElement {
  return (
    <group position={[0, 0.88, 0.05]}>
      <mesh geometry={torusGeom} rotation={[Math.PI / 2, 0, 0]} scale={[0.1, 0.1, 0.04]}>
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh geometry={sphereGeom} position={[0, 0.03, 0]} scale={[0.015, 0.02, 0.015]}>
        <meshStandardMaterial color="#FFFFFF" emissive={color} emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

function Sunglasses3D({ color }: { color: string }): ReactElement {
  const lensColor = new THREE.Color(color).multiplyScalar(0.3).getHexString();
  return (
    <group position={[0, 0.72, 0.17]}>
      {/* Left lens */}
      <mesh geometry={cylinderGeom} position={[-0.06, 0, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.04, 0.01, 0.035]}>
        <meshStandardMaterial color={`#${lensColor}`} metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Right lens */}
      <mesh geometry={cylinderGeom} position={[0.06, 0, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.04, 0.01, 0.035]}>
        <meshStandardMaterial color={`#${lensColor}`} metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Bridge */}
      <mesh geometry={boxGeom} position={[0, 0, 0]} scale={[0.04, 0.008, 0.008]}>
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}

function Monocle3D({ color }: { color: string }): ReactElement {
  return (
    <group position={[0.06, 0.72, 0.18]}>
      <mesh geometry={torusGeom} rotation={[Math.PI / 2, 0, 0]} scale={[0.04, 0.04, 0.04]}>
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Chain dangling */}
      <mesh geometry={boxGeom} position={[0.03, -0.04, 0]} scale={[0.003, 0.08, 0.003]}>
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
}

function Hat3D({ color }: { color: string }): ReactElement {
  return (
    <group position={[0, 0.9, 0]}>
      {/* Brim */}
      <mesh geometry={cylinderGeom} scale={[0.16, 0.01, 0.14]}>
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Crown of hat */}
      <mesh geometry={cylinderGeom} position={[0, 0.04, 0]} scale={[0.1, 0.06, 0.1]}>
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function Beanie3D({ color }: { color: string }): ReactElement {
  return (
    <group position={[0, 0.85, 0]}>
      <mesh geometry={sphereGeom} scale={[0.14, 0.08, 0.13]}>
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Pom-pom */}
      <mesh geometry={sphereGeom} position={[0, 0.08, 0]} scale={[0.03, 0.03, 0.03]}>
        <meshStandardMaterial color={new THREE.Color(color).offsetHSL(0, 0, 0.2).getHexString()} />
      </mesh>
    </group>
  );
}

function Collar3D({ color }: { color: string }): ReactElement {
  return (
    <group position={[0, 0.48, 0]}>
      <mesh geometry={torusGeom} rotation={[Math.PI / 2, 0, 0]} scale={[0.13, 0.13, 0.06]}>
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Pendant */}
      <mesh geometry={sphereGeom} position={[0, -0.02, 0.12]} scale={[0.015, 0.015, 0.015]}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

function NecklaceChain3D({ color }: { color: string }): ReactElement {
  return (
    <group position={[0, 0.48, 0.1]}>
      <mesh geometry={torusGeom} rotation={[Math.PI / 2.2, 0, 0]} scale={[0.12, 0.12, 0.04]}>
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}

function GemPendant3D({ color }: { color: string }): ReactElement {
  return (
    <group position={[0, 0.43, 0.16]}>
      {/* Diamond shape from two cones */}
      <mesh geometry={coneGeom} position={[0, 0.012, 0]} scale={[0.02, 0.02, 0.02]}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} transparent opacity={0.85} />
      </mesh>
      <mesh geometry={coneGeom} position={[0, -0.012, 0]} rotation={[Math.PI, 0, 0]} scale={[0.02, 0.015, 0.02]}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

function Cape3D({ color }: { color: string }): ReactElement {
  return (
    <group position={[0, 0.35, -0.15]}>
      <mesh geometry={boxGeom} scale={[0.28, 0.35, 0.02]}>
        <meshStandardMaterial color={color} transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Scarf3D({ color }: { color: string }): ReactElement {
  return (
    <group position={[0, 0.5, 0]}>
      <mesh geometry={torusGeom} rotation={[Math.PI / 2, 0, 0]} scale={[0.14, 0.14, 0.08]}>
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Dangling end */}
      <mesh geometry={boxGeom} position={[0.12, -0.06, 0.05]} rotation={[0, 0, -0.3]} scale={[0.03, 0.1, 0.02]}>
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function Goggles3D({ color }: { color: string }): ReactElement {
  return (
    <group position={[0, 0.78, 0.1]}>
      {/* Strap */}
      <mesh geometry={torusGeom} rotation={[Math.PI / 2, 0, 0]} scale={[0.14, 0.14, 0.04]}>
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Left lens */}
      <mesh geometry={cylinderGeom} position={[-0.06, -0.04, 0.08]} rotation={[Math.PI / 2, 0, 0]} scale={[0.035, 0.015, 0.035]}>
        <meshStandardMaterial color="#88CCFF" metalness={0.8} roughness={0.1} transparent opacity={0.7} />
      </mesh>
      {/* Right lens */}
      <mesh geometry={cylinderGeom} position={[0.06, -0.04, 0.08]} rotation={[Math.PI / 2, 0, 0]} scale={[0.035, 0.015, 0.035]}>
        <meshStandardMaterial color="#88CCFF" metalness={0.8} roughness={0.1} transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

function EvolutionGlow3D({ color, intensity }: { color: string; intensity: number }): ReactElement {
  return (
    <group>
      <pointLight position={[0, 0.5, 0.3]} color={color} intensity={intensity * 2} distance={2} />
      {/* Subtle aura sphere */}
      <mesh geometry={sphereGeom} position={[0, 0.45, 0]} scale={[0.35, 0.45, 0.3]}>
        <meshStandardMaterial color={color} transparent opacity={intensity * 0.15} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────
// Accessory name → component dispatch
// ─────────────────────────────────────────────

/** Render a single named accessory. Returns null for unknown names. */
function renderAccessory3D(name: string, accent: string): ReactElement | null {
  switch (name) {
    // Bow ties / ribbons
    case 'bow-tie':
    case 'pink-bow':
    case 'velvet-ribbon':
      return <BowTie3D key={name} color={accent} />;

    // Crowns / tiaras
    case 'crown':
      return <Crown3D key={name} color={accent} />;
    case 'tiny-crown':
      return <TinyCrown3D key={name} color={accent} />;
    case 'tiara':
    case 'tiara-gold':
      return <Tiara3D key={name} color="#FFD700" />;
    case 'tiara-silver':
      return <Tiara3D key={name} color="#C0C0C0" />;

    // Glasses / goggles
    case 'sunglasses':
      return <Sunglasses3D key={name} color="#222222" />;
    case 'monocle':
      return <Monocle3D key={name} color="#C4A000" />;
    case 'racing-goggles':
    case 'pixel-glasses':
    case 'round-glasses':
      return <Goggles3D key={name} color={accent} />;

    // Hats
    case 'fedora':
    case 'trilby':
      return <Hat3D key={name} color="#3A3A3A" />;
    case 'flat-cap':
      return <Hat3D key={name} color="#6B8E23" />;
    case 'chef-hat':
      return <Hat3D key={name} color="#FFFFFF" />;
    case 'beanie':
      return <Beanie3D key={name} color={accent} />;
    case 'golden-headphones':
      return <Goggles3D key={name} color="#FFD700" />;

    // Neck / collars
    case 'scarf':
      return <Scarf3D key={name} color={accent} />;
    case 'crescent-collar':
    case 'lightning-collar':
      return <Collar3D key={name} color={accent} />;
    case 'pearl-necklace':
      return <NecklaceChain3D key={name} color="#FFF5EE" />;
    case 'gold-chain':
      return <NecklaceChain3D key={name} color="#FFD700" />;
    case 'kimono-sash':
      return <Scarf3D key={name} color={accent} />;
    case 'temple-bell':
      return <GemPendant3D key={name} color="#FFD700" />;

    // Capes / robes
    case 'cape':
    case 'cape-purple':
      return <Cape3D key={name} color={accent} />;
    case 'golden-cape':
    case 'royal-robe':
    case 'royal-cape-white':
      return <Cape3D key={name} color="#FFD700" />;
    case 'apron':
    case 'conductor-coat':
      return <Cape3D key={name} color={accent} />;

    // Pendants / gems
    case 'gem-pendant':
    case 'accessory-2':
      return <GemPendant3D key={name} color={accent} />;

    // Generic accessory-1 (simple collar)
    case 'accessory-1':
      return <Collar3D key={name} color={accent} />;
    case 'accessory-3':
      return <Crown3D key={name} color={accent} />;

    // Decorative (don't render geometry — these are effects/auras)
    case 'sax':
    case 'fiddle':
    case 'cookie-wand':
    case 'baton':
    case 'cherry-blossom':
    case 'constellation':
    case 'speed-aura':
    case 'candelabra':
    case 'piano-throne':
      return null;

    default:
      return null;
  }
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

interface CatAccessories3DProps {
  /** Accessory name list from catCharacters.ts evolutionVisuals */
  accessories: string[];
  /** Accent color (hex) for the cat */
  accentColor: string;
  /** Whether this stage has glow */
  hasGlow: boolean;
  /** Aura intensity 0-1 */
  auraIntensity: number;
}

/**
 * Renders all 3D accessories for a cat at its current evolution stage.
 * Add as a child of the cat model's <group>.
 */
export function CatAccessories3D({
  accessories,
  accentColor,
  hasGlow,
  auraIntensity,
}: CatAccessories3DProps): ReactElement {
  return (
    <group>
      {accessories.map((name) => renderAccessory3D(name, accentColor))}
      {hasGlow && auraIntensity > 0 && (
        <EvolutionGlow3D color={accentColor} intensity={auraIntensity} />
      )}
    </group>
  );
}
