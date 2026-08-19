import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { Switch } from '../../components/Switch';
import type { ChordEntry, ChordSet } from '../../lib/types';
import { keyboardEventCodeToKanataId } from '../keyboard/keyEventCode';
import { MAX_CHORD_TIMEOUT_MS } from './chordValidation';

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

export function ChordSetDialog({
  open,
  set,
  setIndex,
  layers,
  conflicts,
  onChange,
  onDelete,
  onSelectAction,
  onClose,
}: {
  open: boolean;
  set: ChordSet;
  setIndex: number;
  layers: string[];
  conflicts: Set<string>;
  onChange: (set: ChordSet) => void;
  onDelete: () => void;
  onSelectAction: (chordIndex: number) => void;
  onClose: () => void;
}) {
  const [recording, setRecording] = useState<number>();
  const setRef = useRef(set);
  useEffect(() => { setRef.current = set; }, [set]);

  const emit = (next: ChordSet) => {
    setRef.current = next;
    onChange(next);
  };

  useEffect(() => {
    if (!open || recording === undefined) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const key = keyboardEventCodeToKanataId(event.code);
      const currentSet = setRef.current;
      const current = currentSet.chords[recording];
      if (!key || !current || current.keys.includes(key)) return;
      event.preventDefault();
      const chords = [...currentSet.chords];
      chords[recording] = { ...current, keys: [...current.keys, key] };
      const next = { ...currentSet, chords };
      setRef.current = next;
      onChange(next);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const key = keyboardEventCodeToKanataId(event.code);
      const current = setRef.current.chords[recording];
      if (key && current?.keys.includes(key) && current.keys.length >= 2) {
        event.preventDefault();
        setRecording(undefined);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [onChange, open, recording]);

  useEffect(() => {
    if (!open) setRecording(undefined);
  }, [open]);

  const replaceChord = (chordIndex: number, chord: ChordEntry) => {
    const currentSet = setRef.current;
    const chords = [...currentSet.chords];
    chords[chordIndex] = chord;
    emit({ ...currentSet, chords });
  };

  const addChord = () => {
    const currentSet = setRef.current;
    const chordIndex = currentSet.chords.length;
    emit({
      ...currentSet,
      chords: [...currentSet.chords, { keys: [], action: { type: 'key', key: 'esc' } }],
    });
    setRecording(chordIndex);
  };

  const removeChord = (chordIndex: number) => {
    const currentSet = setRef.current;
    emit({ ...currentSet, chords: currentSet.chords.filter((_, index) => index !== chordIndex) });
    setRecording(undefined);
  };

  const setManualKeys = (chordIndex: number, value: string) => {
    const keys = value.toLowerCase().split(/[+,\s]+/).filter(Boolean);
    replaceChord(chordIndex, { ...setRef.current.chords[chordIndex], keys: [...new Set(keys)] });
  };

  const toggleAllLayers = (checked: boolean) => {
    emit({ ...setRef.current, layers: checked ? [] : [...layers] });
  };

  const toggleLayer = (layer: string, checked: boolean) => {
    const currentSet = setRef.current;
    if (currentSet.layers.length === 0) return;
    if (!checked && currentSet.layers.length === 1 && currentSet.layers[0] === layer) return;
    const nextLayers = checked
      ? [...new Set([...currentSet.layers, layer])]
      : currentSet.layers.filter(item => item !== layer);
    emit({ ...currentSet, layers: nextLayers });
  };

  return <Modal open={open} title="Chord set" onClose={onClose} className="chord-set-dialog">
    <div className="dialog-form">
      <div className="chord-set-fields">
        <label className="field">Name
          <input className="ui-input" value={set.name}
            onChange={event => emit({ ...setRef.current, name: event.target.value })} />
        </label>
        <label className="field">Timeout (ms)
          <input className="ui-input" aria-label="Chord timeout" type="number" min={1}
            max={MAX_CHORD_TIMEOUT_MS} value={set.timeoutMs}
            onChange={event => emit({ ...setRef.current, timeoutMs: Number(event.target.value) })} />
        </label>
        <div className="chord-layer-scope">
          <span>Active layers</span>
          <Switch label="All layers" checked={set.layers.length === 0} onChange={toggleAllLayers} />
          {layers.map(layer => <Switch
            key={layer}
            label={layer}
            disabled={set.layers.length === 0}
            checked={set.layers.length === 0 || set.layers.includes(layer)}
            onChange={checked => toggleLayer(layer, checked)}
          />)}
        </div>
        {!set.name.trim() && <span className="chord-error">Chord Set name is required</span>}
        {(!Number.isInteger(set.timeoutMs) || set.timeoutMs < 1 || set.timeoutMs > MAX_CHORD_TIMEOUT_MS)
          && <span className="chord-error">Timeout must be 1–65535 ms</span>}
      </div>

      <div className="chord-list-head">
        <strong>Combinations</strong>
        <Button type="button" onClick={addChord}>Add chord</Button>
      </div>
      <div className="chord-list">
        {set.chords.map((chord, chordIndex) => {
          const id = `${setIndex}:${chordIndex}`;
          const isRecording = recording === chordIndex;
          return <div className="chord-row" key={id}>
            <button className="chord-trigger" type="button" onClick={() => setRecording(chordIndex)}>
              {isRecording ? `Recording… ${chordLabel(chord)}` : chordLabel(chord)}
            </button>
            <span className="chord-arrow">→</span>
            <button className="chord-action" type="button" onClick={() => onSelectAction(chordIndex)}>
              {actionLabel(chord)}
            </button>
            <input className="ui-input chord-manual" aria-label={`Manual keys ${chordIndex + 1}`}
              value={chord.keys.join(' + ')} onChange={event => setManualKeys(chordIndex, event.target.value)} />
            <Button type="button" onClick={() => removeChord(chordIndex)}>Delete</Button>
            {chord.keys.length < 2 && <span className="chord-error">Use at least two physical keys</span>}
            {conflicts.has(id) && <span className="chord-error">Conflicts with another active chord</span>}
          </div>;
        })}
      </div>

      <div className="dialog-actions">
        <Button type="button" onClick={() => { onDelete(); onClose(); }}>Delete set</Button>
        <Button type="button" className="primary" onClick={onClose}>Close</Button>
      </div>
    </div>
  </Modal>;
}
