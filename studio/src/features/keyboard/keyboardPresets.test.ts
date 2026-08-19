import { describe, expect, it } from 'vitest';
import { presetKeys } from './keyboardPresets';

describe('generic extended keyboard geometry', () => {
  it('shows navigation and arrows without inventing a numpad or Fn layer', () => {
    const preset = presetKeys(undefined, 'Ansi');
    const ids = new Set(preset.keys.map(key => key.id));
    for (const id of ['prtsc', 'slck', 'pause', 'ins', 'home', 'pgup', 'del', 'end', 'pgdn', 'up', 'left', 'down', 'right']) {
      expect(ids.has(id), `${id} should be visible`).toBe(true);
    }
    expect(ids.has('kp0')).toBe(false);
    expect(ids.has('kp1')).toBe(false);
    expect(ids.has('fn')).toBe(false);
    expect(preset.label).toBe('Generic Extended');
    expect(preset.fnLegends).toEqual({});
    expect(preset.fnKey).toBeUndefined();
  });

  it('keeps the full-size preset navigation cluster and numpad', () => {
    const preset = presetKeys('fullsize', 'Ansi');
    const ids = new Set(preset.keys.map(key => key.id));
    expect(ids.has('ins')).toBe(true);
    expect(ids.has('right')).toBe(true);
    expect(ids.has('kp0')).toBe(true);
  });

  it('keeps ISO and JIS physical keys when Auto resolves a full-size board', () => {
    const isoIds = new Set(presetKeys('fullsize', 'Iso').keys.map(key => key.id));
    const jisIds = new Set(presetKeys('fullsize', 'Jis').keys.map(key => key.id));
    expect(isoIds.has('non_us_bslash')).toBe(true);
    expect(jisIds.has('muhenkan')).toBe(true);
    expect(jisIds.has('henkan')).toBe(true);
  });
});
