import type { ChordSet } from '../../lib/types';

export function canonicalChordKeys(keys: string[]) {
  return [...keys].sort().join('+');
}

function scopesOverlap(left: string[], right: string[]) {
  return left.length === 0 || right.length === 0
    || left.some((layer) => right.includes(layer));
}

export function chordConflictIds(sets: ChordSet[]) {
  const conflicts = new Set<string>();
  const entries = sets.flatMap((set, setIndex) => set.chords.map((chord, chordIndex) => ({
    id: `${setIndex}:${chordIndex}`,
    keys: canonicalChordKeys(chord.keys),
    layers: set.layers,
  })));
  for (let left = 0; left < entries.length; left += 1) {
    for (let right = left + 1; right < entries.length; right += 1) {
      if (entries[left].keys && entries[left].keys === entries[right].keys
        && scopesOverlap(entries[left].layers, entries[right].layers)) {
        conflicts.add(entries[left].id);
        conflicts.add(entries[right].id);
      }
    }
  }
  return conflicts;
}

export function chordSetsValid(sets: ChordSet[], availableLayers: string[]) {
  const knownLayers = new Set(availableLayers);
  if (chordConflictIds(sets).size > 0) return false;
  return sets.every((set) => set.name.trim().length > 0
    && Number.isFinite(set.timeoutMs)
    && set.timeoutMs > 0
    && set.layers.every((layer) => knownLayers.has(layer))
    && set.chords.every((chord) => chord.keys.length >= 2
      && new Set(chord.keys).size === chord.keys.length));
}
