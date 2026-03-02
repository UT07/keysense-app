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

  it('blush is null for cats without blush marks', () => {
    expect(getCatColors('jazzy').blush).toBeNull();
    expect(getCatColors('luna').blush).toBeNull();
    expect(getCatColors('sable').blush).toBeNull();
  });

  it('blush is a hex color for cats with blush', () => {
    expect(getCatColors('mini-meowww').blush).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(getCatColors('biscuit').blush).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(getCatColors('chonky-monke').blush).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});
