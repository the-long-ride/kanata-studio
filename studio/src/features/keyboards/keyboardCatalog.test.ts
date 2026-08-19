import { describe, expect, it } from 'vitest';
import { buildKeyboardCatalog, resolveVisualPreset } from './keyboardCatalog';

describe('resolveVisualPreset', () => {
  it('uses override, then name, then strong hardware metadata', () => {
    expect(resolveVisualPreset({ override: '65', name: 'Generic keyboard', layout: 'Ansi', reportedKeyCount: 104 })).toBe('65');
    expect(resolveVisualPreset({ name: 'Keychron K8 TKL', layout: 'Ansi', reportedKeyCount: 104 })).toBe('tkl');
    expect(resolveVisualPreset({ name: 'NuPhy Air75', layout: 'Ansi', reportedKeyCount: 104 })).toBe('75');
    expect(resolveVisualPreset({ name: 'Windows keyboard', layout: 'Ansi', reportedKeyCount: 104 })).toBe('fullsize');
  });

  it('keeps weak compact metadata on generic extended geometry', () => {
    expect(resolveVisualPreset({ name: 'Windows keyboard', layout: 'Ansi', reportedKeyCount: 87 })).toBeUndefined();
    expect(resolveVisualPreset({ name: 'Unknown keyboard', layout: 'Iso' })).toBeUndefined();
  });

  it('carries hardware metadata into catalog items', () => {
    const [keyboard] = buildKeyboardCatalog([], [{
      id: 'kbd',
      name: 'Windows keyboard',
      layout: 'Ansi',
      reportedKeyCount: 104,
      functionKeyCount: 12,
      keyboardType: 4,
    }]);
    expect(keyboard.visualPreset).toBe('fullsize');
    expect(keyboard.reportedKeyCount).toBe(104);
    expect(keyboard.functionKeyCount).toBe(12);
    expect(keyboard.keyboardType).toBe(4);
  });

  it('keeps an unknown keyboard on generic ISO/JIS geometry', () => {
    const [iso] = buildKeyboardCatalog([], [{
      id: 'iso-generic',
      name: 'USB Keyboard',
      layout: 'Iso',
      reportedKeyCount: 87,
    }]);
    const [jis] = buildKeyboardCatalog([], [{
      id: 'jis-generic',
      name: 'USB Keyboard',
      layout: 'Jis',
      reportedKeyCount: 87,
    }]);
    expect(iso.visualPreset).toBeUndefined();
    expect(jis.visualPreset).toBeUndefined();
  });
});
