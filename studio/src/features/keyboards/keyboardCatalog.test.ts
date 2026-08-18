import { describe, expect, it } from 'vitest';
import * as catalog from './keyboardCatalog';

const resolveVisualPreset = (catalog as unknown as Record<string, unknown>).resolveVisualPreset;

describe('resolveVisualPreset', () => {
  it('prefers explicit override, then device-name heuristics, then generic fallback', () => {
    expect(typeof resolveVisualPreset).toBe('function');
    if (typeof resolveVisualPreset !== 'function') return;
    const resolve = resolveVisualPreset as (input: {
      override?: string | null;
      name: string;
      layout: string;
    }) => string;
    expect(resolve({ override: '65', name: 'Generic keyboard', layout: 'Ansi' })).toBe('65');
    expect(resolve({ name: 'Keychron K8 TKL', layout: 'Ansi' })).toBe('tkl');
    expect(resolve({ name: 'NuPhy Air75', layout: 'Ansi' })).toBe('75');
    expect(resolve({ name: 'Unknown keyboard', layout: 'Ansi' })).toBe('fullsize');
  });
});
