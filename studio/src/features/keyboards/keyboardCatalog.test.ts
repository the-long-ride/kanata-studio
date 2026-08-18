import { describe, expect, it } from 'vitest';
import { buildKeyboardCatalog, resolveVisualPreset } from './keyboardCatalog';

describe('resolveVisualPreset', () => {
  it('prefers explicit override, then device-name heuristics, then generic fallback', () => {
    expect(resolveVisualPreset({ override: '65', name: 'Generic keyboard', layout: 'Ansi' })).toBe('65');
    expect(resolveVisualPreset({ name: 'Keychron K8 TKL', layout: 'Ansi' })).toBe('tkl');
    expect(resolveVisualPreset({ name: 'NuPhy Air75', layout: 'Ansi' })).toBe('75');
    expect(resolveVisualPreset({ name: 'Unknown keyboard', layout: 'Iso' })).toBeUndefined();
  });

  it('keeps an unknown keyboard on generic ISO/JIS geometry', () => {
    const [iso] = buildKeyboardCatalog([], [{
      id: 'iso-generic',
      name: 'USB Keyboard',
      layout: 'Iso',
    }]);
    const [jis] = buildKeyboardCatalog([], [{
      id: 'jis-generic',
      name: 'USB Keyboard',
      layout: 'Jis',
    }]);
    expect(iso.visualPreset).toBeUndefined();
    expect(jis.visualPreset).toBeUndefined();
  });
});
