import { getWhiteKeysInRange, hitTestPianoKey } from '../keyboardHitTest';

describe('keyboardHitTest', () => {
  const startNote = 48; // C3
  const endNote = 71; // B4
  const whiteKeys = getWhiteKeysInRange(startNote, endNote);
  const config = {
    startNote,
    endNote,
    whiteKeys,
    totalWidth: 14 * 56,
    totalHeight: 80,
  };

  it('returns expected white key for lower touch area', () => {
    const note = hitTestPianoKey(10, 70, config);
    expect(note).toBe(48); // C3
  });

  it('returns expected black key for upper overlap area', () => {
    const note = hitTestPianoKey(56, 10, config);
    expect(note).toBe(49); // C#3
  });

  it('does not over-capture nearby white keys as black keys', () => {
    const note = hitTestPianoKey(85, 10, config);
    expect(note).toBe(50); // D3
  });
});
