import {
  COLORS,
  GRADIENTS,
  GLOW,
  SPACING,
  ANIMATION_CONFIG,
  TYPOGRAPHY,
  SHADOWS,
  BORDER_RADIUS,
  COMBO_TIERS,
  RARITY,
  glowColor,
  shadowGlow,
  getComboTier,
} from '../tokens';

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

describe('Design Tokens', () => {
  describe('COLORS', () => {
    it('exports all required color keys', () => {
      const requiredKeys = [
        'background', 'surface', 'surfaceElevated', 'surfaceOverlay',
        'primary', 'primaryLight', 'primaryDark',
        'cardSurface', 'cardBorder', 'cardHighlight',
        'textPrimary', 'textSecondary', 'textMuted', 'textAccent',
        'success', 'warning', 'error', 'info',
        'starGold', 'starEmpty', 'gemGold', 'gemDiamond',
        'evolutionGlow', 'evolutionFlash',
        'streakFlame', 'streakFlameWarm', 'streakFlameMedium', 'streakFlameHot',
        'feedbackPerfect', 'feedbackGood', 'feedbackOk',
        'feedbackEarly', 'feedbackLate', 'feedbackMiss', 'feedbackDefault',
        'comboGold',
      ];
      for (const key of requiredKeys) {
        expect(COLORS).toHaveProperty(key);
      }
    });

    it('has valid hex colors for non-rgba values', () => {
      for (const [key, value] of Object.entries(COLORS)) {
        if (key === 'surfaceOverlay') {
          expect(value).toMatch(/^rgba\(/);
        } else {
          expect(value).toMatch(HEX_REGEX);
        }
      }
    });

    it('uses concert hall palette (black + crimson)', () => {
      expect(COLORS.background).toBe('#0A0A0A');
      expect(COLORS.surface).toBe('#141414');
      expect(COLORS.cardSurface).toBe('#181818');
      expect(COLORS.textPrimary).toBe('#FFFFFF');
    });
  });

  describe('GRADIENTS', () => {
    it('exports gradient arrays with at least 2 colors', () => {
      for (const [key, value] of Object.entries(GRADIENTS)) {
        if (key === 'lavaLamp') continue; // lavaLamp is an object, not array
        expect((value as readonly string[]).length).toBeGreaterThanOrEqual(2);
      }
    });

    it('includes heroGlow and cardWarm gradients', () => {
      expect(GRADIENTS.heroGlow).toHaveLength(3);
      expect(GRADIENTS.cardWarm).toHaveLength(2);
    });

    it('lavaLamp has palettes and duration', () => {
      expect(GRADIENTS.lavaLamp.duration).toBeGreaterThan(0);
      expect(GRADIENTS.lavaLamp.palettes.length).toBeGreaterThanOrEqual(2);
      for (const palette of GRADIENTS.lavaLamp.palettes) {
        expect(palette).toHaveLength(3);
      }
    });
  });

  describe('GLOW', () => {
    it('exports glow colors as rgba strings', () => {
      expect(GLOW.crimson).toMatch(/^rgba\(/);
      expect(GLOW.gold).toMatch(/^rgba\(/);
      expect(GLOW.dark).toMatch(/^rgba\(/);
    });
  });

  describe('glowColor', () => {
    it('converts hex to rgba with default opacity', () => {
      expect(glowColor('#FF0000')).toBe('rgba(255, 0, 0, 0.3)');
    });

    it('accepts custom opacity', () => {
      expect(glowColor('#00FF00', 0.5)).toBe('rgba(0, 255, 0, 0.5)');
    });
  });

  describe('TYPOGRAPHY', () => {
    const categories = ['display', 'heading', 'body', 'caption', 'button'];

    it('has all size categories', () => {
      for (const cat of categories) {
        expect(TYPOGRAPHY).toHaveProperty(cat);
      }
      expect(TYPOGRAPHY).toHaveProperty('special');
    });

    it('each category has lg/md/sm sizes with fontSize and lineHeight', () => {
      for (const cat of categories) {
        const group = TYPOGRAPHY[cat as keyof typeof TYPOGRAPHY] as Record<string, { fontSize: number; lineHeight: number }>;
        for (const size of ['lg', 'md', 'sm']) {
          expect(group[size]).toHaveProperty('fontSize');
          expect(group[size]).toHaveProperty('lineHeight');
          expect(group[size].lineHeight).toBeGreaterThan(group[size].fontSize);
        }
      }
    });

    it('special.score is large for score display', () => {
      expect(TYPOGRAPHY.special.score.fontSize).toBe(48);
    });

    it('special.badge is uppercase', () => {
      expect(TYPOGRAPHY.special.badge.textTransform).toBe('uppercase');
    });
  });

  describe('SHADOWS', () => {
    it('exports sm, md, lg shadow levels', () => {
      expect(SHADOWS).toHaveProperty('sm');
      expect(SHADOWS).toHaveProperty('md');
      expect(SHADOWS).toHaveProperty('lg');
    });
  });

  describe('shadowGlow', () => {
    it('returns shadow config for given color', () => {
      const result = shadowGlow('#DC143C');
      expect(result).toBeDefined();
    });
  });

  describe('SPACING', () => {
    it('exports spacing scale', () => {
      expect(SPACING.xs).toBe(4);
      expect(SPACING.sm).toBe(8);
      expect(SPACING.md).toBe(16);
      expect(SPACING.lg).toBe(24);
      expect(SPACING.xl).toBe(32);
      expect(SPACING.xxl).toBe(48);
    });
  });

  describe('BORDER_RADIUS', () => {
    it('exports radius scale', () => {
      expect(BORDER_RADIUS.sm).toBe(8);
      expect(BORDER_RADIUS.md).toBe(12);
      expect(BORDER_RADIUS.lg).toBe(16);
      expect(BORDER_RADIUS.xl).toBe(24);
      expect(BORDER_RADIUS.full).toBe(9999);
    });
  });

  describe('ANIMATION_CONFIG', () => {
    it('exports legacy spring/bounce/fadeIn/slideUp configs', () => {
      expect(ANIMATION_CONFIG.spring.damping).toBeDefined();
      expect(ANIMATION_CONFIG.spring.stiffness).toBeDefined();
      expect(ANIMATION_CONFIG.bounce.damping).toBeDefined();
      expect(ANIMATION_CONFIG.fadeIn.duration).toBeDefined();
    });

    it('exports duration tokens', () => {
      expect(ANIMATION_CONFIG.duration.instant).toBe(100);
      expect(ANIMATION_CONFIG.duration.fast).toBe(200);
      expect(ANIMATION_CONFIG.duration.normal).toBe(300);
      expect(ANIMATION_CONFIG.duration.slow).toBe(500);
    });

    it('exports spring presets', () => {
      expect(ANIMATION_CONFIG.springSnappy.damping).toBeGreaterThan(ANIMATION_CONFIG.springBouncy.damping);
      expect(ANIMATION_CONFIG.springSnappy.stiffness).toBeGreaterThan(ANIMATION_CONFIG.springGentle.stiffness);
    });

    it('exports stagger delays', () => {
      expect(ANIMATION_CONFIG.stagger.fast).toBeLessThan(ANIMATION_CONFIG.stagger.normal);
      expect(ANIMATION_CONFIG.stagger.normal).toBeLessThan(ANIMATION_CONFIG.stagger.slow);
    });
  });

  describe('COMBO_TIERS', () => {
    it('defines 5 combo tiers', () => {
      expect(COMBO_TIERS).toHaveLength(5);
    });

    it('NORMAL tier starts at 0', () => {
      expect(COMBO_TIERS[0].minCombo).toBe(0);
      expect(COMBO_TIERS[0].name).toBe('NORMAL');
    });

    it('LEGENDARY tier starts at 20', () => {
      expect(COMBO_TIERS[4].minCombo).toBe(20);
      expect(COMBO_TIERS[4].name).toBe('LEGENDARY');
    });

    it('tiers are sorted by minCombo ascending', () => {
      for (let i = 1; i < COMBO_TIERS.length; i++) {
        expect(COMBO_TIERS[i].minCombo).toBeGreaterThan(COMBO_TIERS[i - 1].minCombo);
      }
    });

    it('each tier has required fields', () => {
      for (const tier of COMBO_TIERS) {
        expect(tier.name).toBeTruthy();
        expect(typeof tier.minCombo).toBe('number');
        expect(tier.color).toBeTruthy();
        expect(typeof tier.glowColor).toBe('string');
        expect(typeof tier.borderColor).toBe('string');
        expect(typeof tier.label).toBe('string');
      }
    });
  });

  describe('getComboTier', () => {
    it('returns NORMAL for combo 0', () => {
      expect(getComboTier(0).name).toBe('NORMAL');
    });

    it('returns GOOD for combo 5', () => {
      expect(getComboTier(5).name).toBe('GOOD');
    });

    it('returns FIRE for combo 10', () => {
      expect(getComboTier(10).name).toBe('FIRE');
    });

    it('returns SUPER for combo 15', () => {
      expect(getComboTier(15).name).toBe('SUPER');
    });

    it('returns LEGENDARY for combo 20', () => {
      expect(getComboTier(20).name).toBe('LEGENDARY');
    });

    it('returns LEGENDARY for combo 50', () => {
      expect(getComboTier(50).name).toBe('LEGENDARY');
    });

    it('returns GOOD for combo 7 (between tiers)', () => {
      expect(getComboTier(7).name).toBe('GOOD');
    });
  });

  describe('RARITY', () => {
    it('defines common, rare, epic, legendary rarity', () => {
      expect(RARITY.common).toBeDefined();
      expect(RARITY.rare).toBeDefined();
      expect(RARITY.epic).toBeDefined();
      expect(RARITY.legendary).toBeDefined();
    });

    it('each rarity has borderColor, glowColor, label, gradient', () => {
      for (const key of ['common', 'rare', 'epic', 'legendary'] as const) {
        const r = RARITY[key];
        expect(r.borderColor).toBeTruthy();
        expect(r.glowColor).toBeTruthy();
        expect(r.label).toBeTruthy();
        expect(r.gradient).toHaveLength(2);
      }
    });
  });
});
