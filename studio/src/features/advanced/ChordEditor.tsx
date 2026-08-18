import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import type { ChordEntry, ChordSet } from '../../lib/types';
import { keyboardEventCodeToKanataId } from '../keyboard/keyEventCode';

type Props = {
  chordSets: ChordSet[];
  layers: string[];
  onChange: (sets: ChordSet[]) => void;
  onSelect: (setIndex: number, chordIndex: number) => void;
};

type Recording = { setIndex: number; chordIndex: number };

function canonical(keys: string[]) {
  return [...new Set(keys)].sort().join('+');
}

function scopesOverlap(left: string[], right: string[]) {
  return left.length === 0 || right.length === 0
    || left.some((layer) => right.includes(layer));
}

function conflictIds(sets: ChordSet[]) {
  const conflicts = new Set<string>();
  const entries = sets.flatMap((set, setIndex) => set.chords.map((chord, chordIndex) => ({
    id: `${setIndex}:${chordIndex}`,
    keys: canonical(chord.keys),
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

function keyLabel(key: string) {
  return /^[a-z]$/.test(key) ? key.toUpperCase() : key;
}

function chordLabel(chord: ChordEntry) {
  return chord.keys.map(keyLabel).join(' + ') || 'Record keys';
}

function actionLabel(chord: ChordEntry) {
  if (chord.action.type === 'key') return keyLabel(chord.action.key);
  if (chord.action.type === 'shortcut') {
    return [...chord.action.modifiers, keyLabel(chord.action.key)].join('+');
  }
  return chord.action.type;
}

export function ChordEditor({ chordSets, layers, onChange, onSelect }: Props) {
  const [activeSet, setActiveSet] = useState(0);
  const [recording, setRecording] = useState<Recording>();
  const set = chordSets[activeSet];
  const conflicts = useMemo(() => conflictIds(chordSets), [chordSets]);

  const replaceSet = (setIndex: number, nextSet: ChordSet) => {
    const next = [...chordSets];
    next[setIndex] = nextSet;
    onChange(next);
  };

  const replaceChord = (target: Recording, nextChord: ChordEntry) => {
    const targetSet = chordSets[target.setIndex];
    if (!targetSet) return;
    const chords = [...targetSet.chords];
    chords[target.chordIndex] = nextChord;
    replaceSet(target.setIndex, { ...targetSet, chords });
  };

  useEffect(() => {
    if (!recording) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const key = keyboardEventCodeToKanataId(event.code);
      if (!key) return;
      event.preventDefault();
      const current = chordSets[recording.setIndex]?.chords[recording.chordIndex];
      if (!current || current.keys.includes(key)) return;
      const keys = [...current.keys, key];
      replaceChord(recording, { ...current, keys });
      if (keys.length >= 2) setRecording(undefined);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [chordSets, recording]);

  const addSet = () => {
    const next: ChordSet = {
      name: `Chord Set ${chordSets.length + 1}`,
      timeoutMs: 50,
      layers: [],
      chords: [],
    };
    onChange([...chordSets, next]);
    setActiveSet(chordSets.length);
  };

  const deleteSet = () => {
    if (!set) return;
    onChange(chordSets.filter((_, index) => index !== activeSet));
    setActiveSet(Math.max(0, activeSet - 1));
    setRecording(undefined);
  };

  const addChord = () => {
    if (!set) return;
    const chord: ChordEntry = { keys: [], action: { type: 'key', key: 'esc' } };
    const chordIndex = set.chords.length;
    replaceSet(activeSet, { ...set, chords: [...set.chords, chord] });
    setRecording({ setIndex: activeSet, chordIndex });
  };

  const removeChord = (chordIndex: number) => {
    if (!set) return;
    replaceSet(activeSet, {
      ...set,
      chords: set.chords.filter((_, index) => index !== chordIndex),
    });
    setRecording(undefined);
  };

  const setManualKeys = (chordIndex: number, value: string) => {
    if (!set) return;
    const keys = value.toLowerCase().split(/[+,\s]+/).filter(Boolean);
    const chord = set.chords[chordIndex];
    const chords = [...set.chords];
    chords[chordIndex] = { ...chord, keys: [...new Set(keys)] };
    replaceSet(activeSet, { ...set, chords });
  };

  const toggleAllLayers = (checked: boolean) => {
    if (!set) return;
    replaceSet(activeSet, { ...set, layers: checked ? [] : [...layers] });
  };

  const toggleLayer = (layer: string, checked: boolean) => {
    if (!set || set.layers.length === 0) return;
    const nextLayers = checked
      ? [...new Set([...set.layers, layer])]
      : set.layers.filter((item) => item !== layer);
    replaceSet(activeSet, { ...set, layers: nextLayers });
  };

  return <div className="chord-editor">
    <aside className="chord-set-rail">
      <div className="panel-title">Chord Sets</div>
      <div className="chord-set-list">
        {chordSets.map((item, index) => <button
          key={`${item.name}-${index}`}
          className={index === activeSet ? 'active' : ''}
          aria-pressed={index === activeSet}
          onClick={() => setActiveSet(index)}
        >{item.name || 'Untitled set'}</button>)}
      </div>
      <Button onClick={addSet}>Add chord set</Button>
    </aside>
    <section className="chord-set-main">
      {!set ? <div className="empty-inspector">Add a Chord Set to begin.</div> : <>
        <div className="chord-set-fields">
          <label className="field">Name<input className="ui-input" value={set.name}
            onChange={(event) => replaceSet(activeSet, { ...set, name: event.target.value })}/></label>
          <label className="field">Timeout (ms)<input className="ui-input" aria-label="Chord timeout"
            type="number" min={1} value={set.timeoutMs}
            onChange={(event) => replaceSet(activeSet, { ...set, timeoutMs: Number(event.target.value) })}/></label>
          <div className="chord-layer-scope">
            <span>Active layers</span>
            <label><input type="checkbox" aria-label="All layers" checked={set.layers.length === 0}
              onChange={(event) => toggleAllLayers(event.target.checked)}/> All</label>
            {layers.map((layer) => <label key={layer}><input type="checkbox" aria-label={layer}
              disabled={set.layers.length === 0} checked={set.layers.length === 0 || set.layers.includes(layer)}
              onChange={(event) => toggleLayer(layer, event.target.checked)}/> {layer}</label>)}
          </div>
          <Button onClick={deleteSet}>Delete set</Button>
        </div>
        <div className="chord-list-head"><strong>Combinations</strong><Button onClick={addChord}>Add chord</Button></div>
        <div className="chord-list">
          {set.chords.map((chord, chordIndex) => {
            const id = `${activeSet}:${chordIndex}`;
            const isRecording = recording?.setIndex === activeSet && recording.chordIndex === chordIndex;
            return <div className="chord-row" key={id}>
              <button className="chord-trigger" onClick={() => setRecording({ setIndex: activeSet, chordIndex })}>
                {isRecording ? `Recording… ${chordLabel(chord)}` : chordLabel(chord)}
              </button>
              <span className="chord-arrow">→</span>
              <button className="chord-action" onClick={() => onSelect(activeSet, chordIndex)}>{actionLabel(chord)}</button>
              <input className="ui-input chord-manual" aria-label={`Manual keys ${chordIndex + 1}`}
                value={chord.keys.join(' + ')} onChange={(event) => setManualKeys(chordIndex, event.target.value)}/>
              <Button onClick={() => removeChord(chordIndex)}>Delete</Button>
              {chord.keys.length < 2 && <span className="chord-error">Use at least two physical keys</span>}
              {conflicts.has(id) && <span className="chord-error">Conflicts with another active chord</span>}
            </div>;
          })}
        </div>
      </>}
    </section>
  </div>;
}
