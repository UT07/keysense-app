# Chibi Anime Cat Redesign

**Date:** 2026-03-02
**Status:** Approved
**Scope:** Complete 3D cat model rebuild, color palette overhaul, gacha wardrobe system, SVG fallback consistency

## Summary

Replace all 4 body-type 3D cat models with chibi/gacha-style anime cats. Overhaul all 13 cat color palettes from muted/boring to anime-vivid natural coats with neon eye pops. Add full gacha wardrobe system (6 slots, 50+ items). Update SVG fallback system to match new art direction.

## Art Direction

- **Style:** Chibi / Gacha — 2-head-tall proportions, big sparkly gem eyes, tiny bodies
- **Colors:** Anime-vivid versions of real cat breed coats + neon accent eyes
- **Eyes:** Large circular irises (~40% of face), multiple highlight dots, gradient color, star reflections
- **Personality:** Each cat inspired by a recognizable breed but pumped to anime saturation
- **Fixed cats:** mini-meowww = tuxedo, chonky-monke = orange+white, salsa = dark grey + green eyes

## Color Palette (All 13 Cats)

| Cat | Breed Inspo | Body | Belly | Ear Inner | Eye (Iris) | Nose | Blush | Accent |
|-----|-------------|------|-------|-----------|------------|------|-------|--------|
| mini-meowww | Tuxedo | `#1A1A2E` | `#F0F0F5` | `#FF4D6A` | `#3DFF88` | `#FF4D6A` | `#FF8FA0` | `#3DFF88` |
| jazzy | Russian Blue | `#6B7B9E` | `#A8B8D0` | `#9B59FF` | `#B06EFF` | `#8E7CC3` | — | `#9B59FF` |
| luna | Silver Tabby | `#8A95A8` | `#C8D0DC` | `#5BA8FF` | `#5BA8FF` | `#7088AA` | — | `#5BA8FF` |
| biscuit | Scottish Fold | `#F5D5B8` | `#FFF0E0` | `#FF7EB3` | `#FF7EB3` | `#E8A88A` | `#FFB0C8` | `#FF7EB3` |
| ballymakawww | Ginger Tabby | `#E8873A` | `#FFF0D0` | `#2ECC71` | `#2ECC71` | `#D4763A` | `#FFB07C` | `#2ECC71` |
| aria | Abyssinian | `#D4A855` | `#F5E8C8` | `#FFB020` | `#FFBE44` | `#C09040` | — | `#FFD700` |
| tempo | Flame Point | `#E86840` | `#FFD8C0` | `#FF4500` | `#FF6B20` | `#D04020` | — | `#FF4500` |
| shibu | Siamese | `#F5E6D3` | `#FFF8F0` | `#20B2AA` | `#20CCBB` | `#C8A088` | `#FFD0B8` | `#20B2AA` |
| bella | White Persian | `#F8F8FF` | `#FFFFFF` | `#FF80A0` | `#4488FF` | `#FFB0C0` | `#FFD0DC` | `#4488FF` |
| sable | Chocolate/Burmese | `#5A3828` | `#8A6848` | `#C060FF` | `#C060FF` | `#4A2818` | — | `#C060FF` |
| coda | British Shorthair | `#6E8898` | `#90A8B8` | `#44AAFF` | `#44AAFF` | `#506878` | — | `#44AAFF` |
| chonky-monke | Orange Tabby | `#F0922E` | `#FFF5E8` | `#FFB74D` | `#FFD54F` | `#E08020` | `#FFB74D` | `#FF8C00` |
| salsa (NPC) | Dark Grey | `#484858` | `#707080` | `#FF5252` | `#2ECC71` | `#FF5252` | `#FF5252` | `#2ECC71` |

## Chibi Geometry (4 Body Types)

### Shared Proportions
- **2-head-tall** — head = 55-60% of total height
- Large rounded forehead, small chin
- Big triangular ears with inner curve
- Gem eyes: iris mesh with sculpted highlight bumps
- Stubby paw-feet, minimal arm geometry
- Expressive tail (separate mesh)
- ~3,000-4,000 faces after subdivision

### Named Meshes (compatible with existing MATERIAL_NAME_MAP)
- `Body` — main fur
- `Belly` — lighter underbelly patch
- `Ear_Inner_L`, `Ear_Inner_R` — inner ear color
- `Eye_Iris_L`, `Eye_Iris_R` — large gem-style iris
- `Eye_White_L`, `Eye_White_R` — **NEW** sclera mesh
- `Nose` — small triangle/button
- `Blush_L`, `Blush_R` — circular cheek marks
- `Mouth` — **NEW** simple curved line
- `Tail` — separate mesh for animation

### Body Type Differences

| Type | Head Shape | Body Shape | Cats |
|------|------------|------------|------|
| slim | Slightly elongated oval | Narrow torso, longer legs | mini-meowww, jazzy, aria, tempo, shibu, sable |
| standard | Round | Medium torso, balanced | luna, coda, salsa |
| round | Extra round, puffy cheeks | Plump bean body, short legs | biscuit, ballymakawww, bella |
| chonky | Wide, flat top | Sphere body, no neck, stubby feet | chonky-monke |

## Armature & Animations

### Bone Hierarchy
```
Root → Spine → Chest → Neck → Head
  Head → Ear_L, Ear_R, Eye_L, Eye_R, Jaw
  Chest → Arm_L, Arm_R
Root → Hip → Leg_L, Leg_R
Root → Tail_01 → Tail_02 → Tail_03
```

### 7 NLA Animation Tracks
Same naming convention: `{Prefix}_{Pose}_Track`
- Idle (gentle bob + ear twitch + tail sway)
- Celebrate (bounce + ear perk + tail wag fast)
- Teach (head tilt + paw raise)
- Sleep (curl up + slow breathing + ear droop)
- Play (bouncy + tail chase + pounce)
- Sad (head down + ear flatten + tail tuck)
- Curious (head tilt big + ear forward + tail question-mark)

Chibi-specific: exaggerated head bobble, 2x tail wag amplitude, squash-and-stretch on jumps.

## Gacha Wardrobe System

### 6 Accessory Slots

| Slot | Category | Phase 1 Items (~8 each) |
|------|----------|------------------------|
| `head` | Headwear | Crown, Witch Hat, Cat Ears (meta), Flower Crown, Beret, Halo, Devil Horns, Headphones |
| `face` | Face | Round Glasses, Star Shades, Eye Patch, Blush Stickers, Mask, Monocle, Bandaid, Heart Eyes |
| `outfit` | Outfits | Cape, Hoodie, Kimono, Tuxedo Vest, Sailor Uniform, Armor, Scarf, Bow Tie |
| `back` | Back/Wings | Angel Wings, Bat Wings, Butterfly Wings, Backpack, Jetpack, Music Note Wings, Fairy Wings, Dragon Wings |
| `effect` | Effects | Sparkle Aura, Fire Trail, Music Notes Orbit, Heart Bubbles, Star Dust, Rainbow Ring, Lightning, Snowflakes |
| `pattern` | Fur Pattern | Stripes, Spots, Galaxy Overlay, Flame Pattern, Hearts, Stars, Sakura Petals, Digital Glitch |

### Rarity Tiers
- Common (grey border) — ~50% of items
- Rare (blue border) — ~30%
- Epic (purple border) — ~15%
- Legendary (gold animated shimmer) — ~5%

### Acquisition
- Reward chests (existing system)
- Gem shop (new)
- Achievement unlocks
- Evolution stage milestones

## SVG Fallback Consistency

The SVG CatAvatar system must be updated to look like a simplified version of the 3D cats, not completely different characters.

### Changes
- **Shared color source:** New `catColorPalette.ts` used by both `cat3DConfig.ts` and `catProfiles.ts`
- **Chibi proportions in SVG:** Update `CatBody` shapes — big head, tiny body
- **Gem eye style in SVG:** Larger iris circles with white highlight dots (SVG circles)
- **Same accessory data:** Both `CatAccessories.tsx` (SVG) and `CatAccessories3D.tsx` share the same accessory catalog
- **Matching blush/ear/nose:** Same shapes and relative positions as 3D

## TypeScript File Changes

| File | Change |
|------|--------|
| `catColorPalette.ts` | **NEW** — single source of truth for all cat colors |
| `cat3DConfig.ts` | Import colors from palette, update materials |
| `catProfiles.ts` | Import colors from palette, update SVG profiles |
| `CatParts.tsx` | Redesign SVG components for chibi proportions + gem eyes |
| `ghibliMaterials.ts` | Adjust gradient map for vivid colors |
| `src/data/accessories.ts` | Expand: 6 slots, 50+ items, rarity, acquisition source |
| `settingsStore.ts` | Expand `equippedAccessories` to 6 slots |
| `CatAccessories3D.tsx` | Rewrite for slot-based system |
| `CatAccessories.tsx` | Add SVG accessory rendering matching 3D |
| `MATERIAL_NAME_MAP` in CatModel3D.tsx | Add Eye_White_L/R, Mouth entries |

## Blender Pipeline (Procedural via MCP)

### Scripts (executed via `execute_blender_code`)
1. **create_chibi_base.py** — 4 body type meshes with subdivision surface
2. **create_chibi_rig.py** — armature + automatic bone weights
3. **create_chibi_animations.py** — 7 NLA tracks per body type
4. **create_chibi_eyes.py** — gem eye geometry with highlight bumps
5. **export_all_glbs.py** — batch export 4 GLBs (no Draco compression)

### Export Settings
- Format: GLB (binary glTF)
- No Draco compression (broken on React Native)
- Embedded textures: none (colors applied via TypeScript materials)
- Target file size: <500KB per GLB
- Named materials matching MATERIAL_NAME_MAP

## Implementation Order

1. **Blender: Create 4 chibi base meshes** (procedural Python via MCP)
2. **Blender: Rig + animate** all 4 body types
3. **Blender: Export 4 GLBs** replacing existing files
4. **TypeScript: catColorPalette.ts** — shared color definitions
5. **TypeScript: cat3DConfig.ts** — update to new palette
6. **TypeScript: CatModel3D.tsx** — add new mesh names to MATERIAL_NAME_MAP
7. **TypeScript: catProfiles.ts + CatParts.tsx** — chibi SVG redesign
8. **TypeScript: Accessory system expansion** — 6 slots, catalog, UI
9. **Visual QA** — verify 3D + SVG consistency per cat
10. **Tests** — update snapshots and mock data
