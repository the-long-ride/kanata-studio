import { useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import type { ChordSet } from '../../lib/types';
import { chordConflictIds } from './chordValidation';
import { ChordSetDialog } from './ChordSetDialog';

type Props = {
  chordSets: ChordSet[];
  layers: string[];
  onChange: (sets: ChordSet[]) => void;
  onSelect: (setIndex: number, chordIndex: number) => void;
};

export function ChordEditor({ chordSets, layers, onChange, onSelect }: Props) {
  const [openIndex, setOpenIndex] = useState<number>();
  const conflicts = useMemo(() => chordConflictIds(chordSets), [chordSets]);
  const openSet = openIndex === undefined ? undefined : chordSets[openIndex];

  const addSet = () => {
    const next: ChordSet = {
      name: `Chord Set ${chordSets.length + 1}`,
      timeoutMs: 50,
      layers: [],
      chords: [],
    };
    onChange([...chordSets, next]);
    setOpenIndex(chordSets.length);
  };

  const replaceSet = (setIndex: number, nextSet: ChordSet) => {
    const next = [...chordSets];
    next[setIndex] = nextSet;
    onChange(next);
  };

  const deleteSet = (setIndex: number) => {
    onChange(chordSets.filter((_, index) => index !== setIndex));
    setOpenIndex(undefined);
  };

  return <div className="chord-editor chord-editor-compact">
    <div className="panel-title">Chord Sets</div>
    <div className="chord-set-list">
      {chordSets.map((set, index) => <button
        key={`${set.name}-${index}`}
        className={openIndex === index ? 'active' : ''}
        aria-pressed={openIndex === index}
        onClick={() => setOpenIndex(index)}
      >
        <span>{set.name || 'Untitled set'}</span>
        <small>{set.chords.length} chord{set.chords.length === 1 ? '' : 's'}</small>
      </button>)}
    </div>
    <div className="profile-add">
      <Button onClick={addSet}>Add chord set</Button>
    </div>
    {openSet && openIndex !== undefined && <ChordSetDialog
      open
      set={openSet}
      setIndex={openIndex}
      layers={layers}
      conflicts={conflicts}
      onChange={nextSet => replaceSet(openIndex, nextSet)}
      onDelete={() => deleteSet(openIndex)}
      onSelectAction={chordIndex => onSelect(openIndex, chordIndex)}
      onClose={() => setOpenIndex(undefined)}
    />}
  </div>;
}
