import { describe, expect, it } from 'vitest';
import type { StudioProfile } from '../lib/types';
import { makeAppProfile, setChordAction, setChordSets } from './profileHelpers';

function profile(): StudioProfile {
  return {
    id: 'global', revision: 0, name: 'Global', enabled: true,
    deviceTarget: { kind: 'all' },
    source: {
      kind: 'visual',
      mappings: { j: { type: 'key', key: 'j' }, k: { type: 'key', key: 'k' } },
      advanced: {
        layers: [],
        chordSets: [{
          name: 'Editing', timeoutMs: 50, layers: [],
          chords: [{ keys: ['j', 'k'], action: { type: 'key', key: 'esc' } }],
        }],
      },
    },
  };
}

describe('chord profile helpers', () => {
  it('initializes new app profiles with no chord sets', () => {
    const created = makeAppProfile('Code', 'code');
    expect(created.source.kind).toBe('visual');
    if (created.source.kind === 'visual') expect(created.source.advanced.chordSets).toEqual([]);
  });

  it('updates a chord action without changing member key mappings', () => {
    const updated = setChordAction(profile(), 0, 0, {
      type: 'advanced', action: { type: 'macro', actions: [{ type: 'key', key: 'x' }] },
    });
    if (updated.source.kind !== 'visual') throw new Error('expected visual profile');
    expect(updated.source.mappings.j).toEqual({ type: 'key', key: 'j' });
    expect(updated.source.mappings.k).toEqual({ type: 'key', key: 'k' });
    expect(updated.source.advanced.chordSets?.[0].chords[0].action.type).toBe('advanced');
  });

  it('replaces chord sets while preserving layers', () => {
    const initial = profile();
    if (initial.source.kind !== 'visual') throw new Error('expected visual profile');
    initial.source.advanced.layers = [{ name: 'nav', mappings: {} }];
    const updated = setChordSets(initial, []);
    if (updated.source.kind !== 'visual') throw new Error('expected visual profile');
    expect(updated.source.advanced.layers).toHaveLength(1);
    expect(updated.source.advanced.chordSets).toEqual([]);
  });
});
