# Chibi Anime Cat Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all 3D cat models with chibi/gacha-style anime cats, overhaul all 13 cat color palettes, expand the wardrobe system, and update SVG fallbacks to match.

**Architecture:** Procedural Blender Python scripts generate 4 chibi body-type GLBs via MCP. A shared color palette module (`catColorPalette.ts`) becomes the single source of truth for both 3D (`cat3DConfig.ts`) and SVG (`catCharacters.ts`). The existing material override pipeline (`ghibliMaterials.ts`, `CatModel3D.tsx`) stays intact — only the underlying mesh geometry and hex values change. Accessory system expands from evolution-coupled to a full 6-slot gacha wardrobe.

**Tech Stack:** Blender Python (via MCP `execute_blender_code`), Three.js/R3F, react-native-svg, Zustand, TypeScript

**Design doc:** `docs/plans/2026-03-02-chibi-anime-cat-redesign.md`

---

## Phase 1: Blender — Chibi Cat Models (Tasks 1-5)

### Task 1: Clear Blender Scene & Create Slim Body Type

**Files:**
- Output: `assets/models/slim-cat.glb` (replaced)

**Step 1: Clear scene and create slim chibi head**

Execute via Blender MCP (`execute_blender_code`):
- Delete all objects in scene
- Create head as UV sphere → scale to chibi proportions (large, slightly elongated oval)
- Head center at (0, 0, 3.5), radius ~1.2
- Apply subdivision surface modifier (level 2) for smooth anime look

**Step 2: Create slim chibi body**

Execute via Blender MCP:
- Create body as UV sphere scaled to narrow ellipse
- Body center at (0, 0, 1.5), scale (0.6, 0.5, 0.8)
- 2-head-tall proportion: body is ~60% of head height
- Stubby legs: two small cylinders at bottom

**Step 3: Create ears, eyes, nose, tail**

Execute via Blender MCP:
- Ears: two cone+sphere combos, pointed style, positioned on head top
- Eye sockets: flattened spheres on front face (~40% of face width)
- Eye irises: separate meshes inside sockets (for material override)
- Eye whites (sclera): separate meshes behind irises
- Nose: small triangle mesh centered below eyes
- Blush: two flattened spheres on cheeks
- Mouth: thin plane mesh below nose
- Tail: curve-based tube, long and elegant for slim type

**Step 4: Name all meshes for material override compatibility**

Execute via Blender MCP:
- Rename meshes: `Body`, `Belly`, `Ear_Inner_L`, `Ear_Inner_R`, `Eye_Iris_L`, `Eye_Iris_R`, `Eye_White_L`, `Eye_White_R`, `Nose`, `Blush_L`, `Blush_R`, `Mouth`, `Tail`
- Create named materials matching: `Body`, `Belly`, `Ear_Inner_L`, `Ear_Inner_R`, `Eye_Iris_L`, `Eye_Iris_R`, `Nose`, `Blush_L`, `Blush_R`
- Assign one material per mesh

**Step 5: Take viewport screenshot to verify**

Use `get_viewport_screenshot` to visually confirm chibi proportions look correct before proceeding.

---

### Task 2: Create Standard Body Type

**Files:**
- Output: `assets/models/salsa-cat.glb` (replaced)

**Step 1: Duplicate slim and modify to standard proportions**

Execute via Blender MCP:
- Start from slim body, adjust:
  - Head: perfectly round (equal x/y/z radius ~1.3)
  - Body: medium ellipse (0.7, 0.6, 0.9)
  - Ears: same pointed style
  - Tail: medium length, curled end
- Keep all mesh naming identical to Task 1

**Step 2: Screenshot to verify**

---

### Task 3: Create Round Body Type

**Files:**
- Output: `assets/models/round-cat.glb` (replaced)

**Step 1: Create round chibi variant**

Execute via Blender MCP:
- Head: extra round with puffy cheeks (wider x scale, add cheek bump geometry)
- Body: plump bean shape (0.9, 0.7, 0.8)
- Ears: rounded style (sphere-capped instead of pointed)
- Legs: shorter, wider
- Tail: short and thick

**Step 2: Screenshot to verify**

---

### Task 4: Create Chonky Body Type

**Files:**
- Output: `assets/models/chonky-cat.glb` (replaced)

**Step 1: Create chonky chibi variant**

Execute via Blender MCP:
- Head: widest, flat on top (1.5, 1.2, 1.2 scale)
- Body: near-sphere, almost no visible neck (1.2, 1.0, 1.1)
- Legs: tiny stubs barely visible below body sphere
- Ears: small rounded on wide head
- Tail: short fluffy (thick cylinder + sphere tip)
- Belly: large patch on front

**Step 2: Screenshot to verify**

---

### Task 5: Rig All 4 Bodies & Add Animations & Export

**Files:**
- Output: all 4 GLB files in `assets/models/`

**Step 1: Create shared armature template**

Execute via Blender MCP:
- Bone hierarchy:
  ```
  Root → Spine → Chest → Neck → Head
    Head → Ear_L, Ear_R, Eye_L, Eye_R, Jaw
    Chest → Arm_L, Arm_R
  Root → Hip → Leg_L, Leg_R
  Root → Tail_01 → Tail_02 → Tail_03
  ```
- Prefix per body type: `Slim_Armature`, `Cat_Armature`, `Round_Armature`, `Chonk_Armature`

**Step 2: Parent meshes to armature with automatic weights**

**Step 3: Create 7 NLA animation tracks per body type**

Execute via Blender MCP — for each body type, create pose keyframes:
- `{Prefix}_Idle_Track`: gentle head bob (Y translate ±0.05), ear twitch (rotate ±5°), tail sway (rotate ±15°)
- `{Prefix}_Celebrate_Track`: bounce up (Y +0.3), ears perk (rotate +10°), tail wag fast (±25°)
- `{Prefix}_Teach_Track`: head tilt (Z rotate 10°), one arm raise
- `{Prefix}_Sleep_Track`: head down (X rotate -15°), ears droop (rotate -10°), tail curl tight
- `{Prefix}_Play_Track`: bouncy whole body, tail chase motion
- `{Prefix}_Sad_Track`: head down, ears flatten, tail tuck
- `{Prefix}_Curious_Track`: big head tilt, ears forward, tail question-mark curve

**Step 4: Export all 4 as GLB (no Draco)**

Execute via Blender MCP:
- For each body type: select all objects, export as GLB
- Settings: `export_animations=True`, `export_skins=True`, no Draco
- Output to `/Users/ut/purrrfect-keys/assets/models/{type}-cat.glb`

**Step 5: Verify file sizes < 500KB each**

---

## Phase 2: Color Palette & TypeScript Updates (Tasks 6-9)

### Task 6: Create Shared Color Palette

**Files:**
- Create: `src/components/Mascot/catColorPalette.ts`
- Test: `src/components/Mascot/__tests__/catColorPalette.test.ts`

**Step 1: Write the test**

```typescript
// src/components/Mascot/__tests__/catColorPalette.test.ts
import { getCatColors, ALL_CAT_IDS } from '../catColorPalette';

describe('catColorPalette', () => {
  it('returns colors for all 13 cats', () => {
    expect(ALL_CAT_IDS).toHaveLength(13);
    for (const id of ALL_CAT_IDS) {
      const colors = getCatColors(id);
      expect(colors.body).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(colors.eye).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(colors.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('mini-meowww is tuxedo (dark body, white belly)', () => {
    const c = getCatColors('mini-meowww');
    expect(c.body).toBe('#1A1A2E');
    expect(c.belly).toBe('#F0F0F5');
  });

  it('chonky-monke is orange and white', () => {
    const c = getCatColors('chonky-monke');
    expect(c.body).toBe('#F0922E');
    expect(c.belly).toBe('#FFF5E8');
  });

  it('salsa is dark grey with green eyes', () => {
    const c = getCatColors('salsa');
    expect(c.body).toBe('#484858');
    expect(c.eye).toBe('#2ECC71');
  });

  it('falls back to salsa colors for unknown cat', () => {
    const c = getCatColors('unknown-cat');
    expect(c.body).toBe('#484858');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/components/Mascot/__tests__/catColorPalette.test.ts --no-coverage`
Expected: FAIL — module not found

**Step 3: Implement catColorPalette.ts**

```typescript
// src/components/Mascot/catColorPalette.ts
export interface CatColors {
  body: string;
  belly: string;
  earInner: string;
  eye: string;
  nose: string;
  blush: string | null;
  accent: string;
}

const PALETTE: Record<string, CatColors> = {
  'mini-meowww': { body: '#1A1A2E', belly: '#F0F0F5', earInner: '#FF4D6A', eye: '#3DFF88', nose: '#FF4D6A', blush: '#FF8FA0', accent: '#3DFF88' },
  'jazzy':       { body: '#6B7B9E', belly: '#A8B8D0', earInner: '#9B59FF', eye: '#B06EFF', nose: '#8E7CC3', blush: null, accent: '#9B59FF' },
  'luna':        { body: '#8A95A8', belly: '#C8D0DC', earInner: '#5BA8FF', eye: '#5BA8FF', nose: '#7088AA', blush: null, accent: '#5BA8FF' },
  'biscuit':     { body: '#F5D5B8', belly: '#FFF0E0', earInner: '#FF7EB3', eye: '#FF7EB3', nose: '#E8A88A', blush: '#FFB0C8', accent: '#FF7EB3' },
  'ballymakawww':{ body: '#E8873A', belly: '#FFF0D0', earInner: '#2ECC71', eye: '#2ECC71', nose: '#D4763A', blush: '#FFB07C', accent: '#2ECC71' },
  'aria':        { body: '#D4A855', belly: '#F5E8C8', earInner: '#FFB020', eye: '#FFBE44', nose: '#C09040', blush: null, accent: '#FFD700' },
  'tempo':       { body: '#E86840', belly: '#FFD8C0', earInner: '#FF4500', eye: '#FF6B20', nose: '#D04020', blush: null, accent: '#FF4500' },
  'shibu':       { body: '#F5E6D3', belly: '#FFF8F0', earInner: '#20B2AA', eye: '#20CCBB', nose: '#C8A088', blush: '#FFD0B8', accent: '#20B2AA' },
  'bella':       { body: '#F8F8FF', belly: '#FFFFFF', earInner: '#FF80A0', eye: '#4488FF', nose: '#FFB0C0', blush: '#FFD0DC', accent: '#4488FF' },
  'sable':       { body: '#5A3828', belly: '#8A6848', earInner: '#C060FF', eye: '#C060FF', nose: '#4A2818', blush: null, accent: '#C060FF' },
  'coda':        { body: '#6E8898', belly: '#90A8B8', earInner: '#44AAFF', eye: '#44AAFF', nose: '#506878', blush: null, accent: '#44AAFF' },
  'chonky-monke':{ body: '#F0922E', belly: '#FFF5E8', earInner: '#FFB74D', eye: '#FFD54F', nose: '#E08020', blush: '#FFB74D', accent: '#FF8C00' },
  'salsa':       { body: '#484858', belly: '#707080', earInner: '#FF5252', eye: '#2ECC71', nose: '#FF5252', blush: '#FF5252', accent: '#2ECC71' },
};

export const ALL_CAT_IDS = Object.keys(PALETTE);

export function getCatColors(catId: string): CatColors {
  return PALETTE[catId] ?? PALETTE['salsa'];
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest src/components/Mascot/__tests__/catColorPalette.test.ts --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/Mascot/catColorPalette.ts src/components/Mascot/__tests__/catColorPalette.test.ts
git commit -m "feat: shared cat color palette with anime-vivid breed colors"
```

---

### Task 7: Update cat3DConfig.ts to Use Shared Palette

**Files:**
- Modify: `src/components/Mascot/3d/cat3DConfig.ts`

**Step 1: Import from shared palette and replace all hardcoded hex values**

Replace the entire `CAT_3D_CONFIGS` record. For each cat:
```typescript
import { getCatColors } from '../catColorPalette';

// In CAT_3D_CONFIGS, replace hardcoded materials:
'mini-meowww': {
  bodyType: 'slim',
  hasBlush: true,
  materials: (() => { const c = getCatColors('mini-meowww'); return { body: c.body, belly: c.belly, earInner: c.earInner, eye: c.eye, nose: c.nose, blush: c.blush ?? undefined, accent: c.accent }; })(),
},
```

Alternative (cleaner): Create a helper function `paletteToMaterials(catId)` that maps `CatColors` → `Cat3DMaterials`.

**Step 2: Add new mesh names to MATERIAL_NAME_MAP in CatModel3D.tsx**

Add entries for the new meshes:
```typescript
// CatModel3D.tsx MATERIAL_NAME_MAP additions:
'Eye_White_L': 'belly',  // sclera uses belly (light) color
'Eye_White_R': 'belly',
'Mouth': 'nose',         // mouth uses nose color
'Tail': 'body',          // tail uses body color
```

**Step 3: Run existing tests**

Run: `npx jest --no-coverage`
Expected: All 122 suites pass (no behavioral changes, only hex values)

**Step 4: Commit**

```bash
git add src/components/Mascot/3d/cat3DConfig.ts src/components/Mascot/3d/CatModel3D.tsx
git commit -m "refactor: cat3DConfig uses shared palette, add new mesh names"
```

---

### Task 8: Update catCharacters.ts Visuals to Use Shared Palette

**Files:**
- Modify: `src/components/Mascot/catCharacters.ts`

**Step 1: Import shared palette and update all 13 CatCharacter visuals blocks**

For each cat in `CAT_CHARACTERS`, replace the `visuals` block:
```typescript
import { getCatColors } from './catColorPalette';

// For each cat, replace hardcoded visuals:
visuals: {
  bodyColor: getCatColors('mini-meowww').body,
  bellyColor: getCatColors('mini-meowww').belly,
  earInnerColor: getCatColors('mini-meowww').earInner,
  eyeColor: getCatColors('mini-meowww').eye,
  noseColor: getCatColors('mini-meowww').nose,
  pattern: 'tuxedo' as CatPattern,
},
```

Update patterns per breed:
- mini-meowww: `'tuxedo'`
- jazzy: `'solid'`
- luna: `'tabby'`
- biscuit: `'solid'`
- ballymakawww: `'tabby'`
- aria: `'solid'`
- tempo: `'solid'`
- shibu: `'siamese'`
- bella: `'solid'`
- sable: `'solid'`
- coda: `'solid'`
- chonky-monke: `'tabby'`
- salsa: `'solid'`

**Step 2: Update catProfiles.ts blush colors to match shared palette**

Update `blushColor` values in each `CAT_PROFILES` entry to match `getCatColors(id).blush`.

**Step 3: Run all tests**

Run: `npx jest --no-coverage`
Expected: All pass

**Step 4: Commit**

```bash
git add src/components/Mascot/catCharacters.ts src/components/Mascot/svg/catProfiles.ts
git commit -m "refactor: catCharacters + catProfiles use shared color palette"
```

---

### Task 9: Update SVG CatParts for Chibi Proportions + Bigger Eyes

**Files:**
- Modify: `src/components/Mascot/svg/CatParts.tsx`

**Step 1: Update CatBody proportions for chibi style**

Current: head at y=42, body at y=65-68 (roughly equal size).
New: head at y=35 (higher, bigger), body at y=70 (lower, smaller). Head occupies ~55% of 100×100 viewBox.

```typescript
// Updated CatBody — smaller bodies, lower position
export function CatBody({ type, color }: { type: BodyType; color: string }): ReactElement {
  switch (type) {
    case 'slim':
      return <Ellipse cx="50" cy="74" rx="14" ry="14" fill={color} />;
    case 'round':
      return <Ellipse cx="50" cy="74" rx="20" ry="15" fill={color} />;
    case 'chonky':
      return <Ellipse cx="50" cy="74" rx="24" ry="17" fill={color} />;
    case 'standard':
    default:
      return <Ellipse cx="50" cy="74" rx="17" ry="14" fill={color} />;
  }
}

// Updated CatHead — bigger, higher
export function CatHead({ color, cheekFluff }: { color: string; cheekFluff?: boolean }): ReactElement {
  return (
    <G>
      <Circle cx="50" cy="38" r="28" fill={color} />
      {cheekFluff && (
        <G>
          <Circle cx="24" cy="45" r="6" fill={color} />
          <Circle cx="76" cy="45" r="6" fill={color} />
        </G>
      )}
    </G>
  );
}
```

**Step 2: Update CatEyes — bigger gem-style eyes for ALL shapes**

Increase eye radius by ~50%, add extra highlight dots for sparkle:
- `big-sparkly`: sclera r=8, iris r=5, pupil r=2, TWO highlight dots (large + small)
- `round`: sclera r=6, iris r=3.5, pupil r=1.5, one highlight
- `almond`: sclera rx=7 ry=5, iris r=3.5, one highlight
- Eye center positions adjusted for new larger head: y=36 (was y=40)
- Eye spacing: left at x=38, right at x=62 (unchanged)

**Step 3: Adjust ear, nose, whisker, tail, blush positions**

All positions shift to match new head/body centers:
- Ears: anchored to new head circle (cy=38, r=28) — ear tips at y~8 (was y~10)
- Nose: y=48 (was y=49)
- Mouth: y=52 (was y=54)
- Whiskers: y range 44-52 (shifted up ~2px)
- Blush: y=46 (was y=50), positioned on new larger cheeks
- Tail: anchored at body edge y=74 (was y=70)

**Step 4: Run all tests**

Run: `npx jest --no-coverage`
Expected: All pass (SVG tests may need snapshot updates)

**Step 5: Commit**

```bash
git add src/components/Mascot/svg/CatParts.tsx
git commit -m "feat: chibi proportions for SVG cat parts — big head, tiny body, gem eyes"
```

---

## Phase 3: Accessory System Expansion (Tasks 10-12)

### Task 10: Expand Accessory Catalog to 6 Slots / 50 Items

**Files:**
- Modify: `src/data/accessories.ts`
- Test: `src/data/__tests__/accessories.test.ts`

**Step 1: Write test for expanded catalog**

```typescript
import { ACCESSORIES, ACCESSORY_CATEGORIES, getAccessoriesByCategory } from '../accessories';

describe('expanded accessory catalog', () => {
  it('has 6 categories', () => {
    expect(ACCESSORY_CATEGORIES).toHaveLength(6);
  });

  it('has at least 48 accessories total', () => {
    expect(ACCESSORIES.length).toBeGreaterThanOrEqual(48);
  });

  it('each category has at least 6 items', () => {
    for (const cat of ACCESSORY_CATEGORIES) {
      expect(getAccessoriesByCategory(cat.key).length).toBeGreaterThanOrEqual(6);
    }
  });

  it('every accessory has required fields', () => {
    for (const acc of ACCESSORIES) {
      expect(acc.id).toBeTruthy();
      expect(acc.name).toBeTruthy();
      expect(acc.gemCost).toBeGreaterThan(0);
      expect(['common', 'rare', 'epic', 'legendary']).toContain(acc.rarity);
    }
  });

  it('rarity distribution is roughly 50/30/15/5', () => {
    const counts = { common: 0, rare: 0, epic: 0, legendary: 0 };
    for (const acc of ACCESSORIES) counts[acc.rarity]++;
    expect(counts.common).toBeGreaterThan(counts.rare);
    expect(counts.rare).toBeGreaterThan(counts.epic);
    expect(counts.epic).toBeGreaterThan(counts.legendary);
  });
});
```

**Step 2: Run test, verify fail**

**Step 3: Expand ACCESSORIES array + update ACCESSORY_CATEGORIES**

Update `AccessoryCategory` type to: `'head' | 'face' | 'outfit' | 'back' | 'effect' | 'pattern'`

Add ~48 items across 6 categories (see design doc for full list per category).

Update `ACCESSORY_RENDER_NAMES` for all new items.

**Step 4: Run test, verify pass**

**Step 5: Commit**

```bash
git add src/data/accessories.ts src/data/__tests__/accessories.test.ts
git commit -m "feat: expand accessory catalog to 6 slots, 48+ items with rarity tiers"
```

---

### Task 11: Update CatAccessories3D for New Items

**Files:**
- Modify: `src/components/Mascot/3d/CatAccessories3D.tsx`

**Step 1: Add new 3D accessory components**

Add Three.js geometry components for new items:
- Headwear: `WitchHat3D`, `FlowerCrown3D`, `Halo3D`, `DevilHorns3D`, `Headphones3D`, `CatEarsMeta3D`
- Face: `StarShades3D`, `EyePatch3D`, `Bandaid3D`, `HeartEyes3D`
- Back: `AngelWings3D`, `BatWings3D`, `ButterflyWings3D`, `Backpack3D`, `MusicNoteWings3D`
- Outfits: `Hoodie3D`, `Kimono3D`, `SailorUniform3D`, `Armor3D`

Each is simple procedural Three.js geometry (spheres, cones, boxes, tori).

**Step 2: Update `renderAccessory3D` switch to dispatch new items**

**Step 3: Run all tests**

**Step 4: Commit**

```bash
git add src/components/Mascot/3d/CatAccessories3D.tsx
git commit -m "feat: 20+ new 3D accessory components for gacha wardrobe"
```

---

### Task 12: Update settingsStore for 6 Accessory Slots

**Files:**
- Modify: `src/stores/settingsStore.ts`

**Step 1: Update equippedAccessories type**

The current `Record<string, string>` already supports arbitrary slot keys, so no type change needed. But ensure the `equipAccessory` / `unequipAccessory` actions work with the new category keys (`head`, `face`, `outfit`, `back`, `effect`, `pattern`).

**Step 2: Verify tests pass**

Run: `npx jest --no-coverage`

**Step 3: Commit (if any changes needed)**

---

## Phase 4: Integration & QA (Tasks 13-15)

### Task 13: Verify 3D Rendering with New GLBs

**Step 1: Run the app on iOS simulator**

```bash
npm run ios
```

**Step 2: Navigate to each screen that shows 3D cats**

Check: HomeScreen hero, CatSwitchScreen gallery, CompletionModal, AuthScreen.
Verify:
- Models load without errors
- Material colors match palette
- Animations play correctly
- No console warnings about missing meshes/materials

**Step 3: Test SVG fallback**

Set `forceSVG={true}` temporarily on Cat3DCanvas and verify SVG cats:
- Have correct chibi proportions (big head, small body)
- Colors match 3D versions exactly
- Blush, ears, tail look right

---

### Task 14: Run Full Test Suite

**Step 1: Run typecheck + tests**

```bash
npm run typecheck && npm run test -- --no-coverage
```

Expected: 0 TypeScript errors, all ~122 suites pass.

**Step 2: Fix any snapshot test failures**

SVG component tests may need snapshot updates due to changed coordinates.
Run: `npx jest --updateSnapshot` if needed (after manual verification).

**Step 3: Commit any test fixes**

---

### Task 15: Final Commit & Update Memory

**Step 1: Commit all remaining changes**

**Step 2: Update MEMORY.md**

Add notes about:
- New shared color palette at `src/components/Mascot/catColorPalette.ts`
- Chibi proportions in SVG (head cy=38 r=28, body cy=74)
- New mesh names in GLBs (Eye_White_L/R, Mouth, Tail)
- 6 accessory slots replacing old evolution-coupled system

**Step 3: Update stabilization-report.md**

Add section for "Chibi Anime Cat Redesign" with summary of all changes.
