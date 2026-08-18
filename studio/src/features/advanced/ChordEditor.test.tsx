import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it } from 'vitest';
import type { ChordSet } from '../../lib/types';
import { ChordEditor } from './ChordEditor';

afterEach(cleanup);

function Harness({ initial = [] }: { initial?: ChordSet[] }) {
  const [sets, setSets] = useState(initial);
  return <>
    <ChordEditor
      chordSets={sets}
      layers={['base', 'nav']}
      onChange={setSets}
      onSelect={() => {}}
    />
    <output data-testid="state">{JSON.stringify(sets)}</output>
  </>;
}

function setWithChords(chords: ChordSet['chords']): ChordSet {
  return {
    name: 'Editing',
    timeoutMs: 50,
    layers: [],
    chords,
  };
}

it('creates a chord set with 50 ms and all layers', () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Add chord set' }));
  expect(screen.getByDisplayValue('Chord Set 1')).toBeInTheDocument();
  expect(screen.getByLabelText('Chord timeout')).toHaveValue(50);
  expect(screen.getByLabelText('All layers')).toBeChecked();
});

it('records physical keys for a new chord', () => {
  render(<Harness initial={[setWithChords([])]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Add chord' }));
  fireEvent.keyDown(window, { code: 'KeyJ' });
  fireEvent.keyDown(window, { code: 'KeyK' });
  expect(screen.getByText('Recording… J + K')).toBeInTheDocument();
  fireEvent.keyUp(window, { code: 'KeyJ' });
  expect(screen.getByText('J + K')).toBeInTheDocument();
  expect(screen.getByTestId('state')).toHaveTextContent('"keys":["j","k"]');
});

it('keeps recording long enough for a three-key chord', () => {
  render(<Harness initial={[setWithChords([])]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Add chord' }));
  fireEvent.keyDown(window, { code: 'KeyJ' });
  fireEvent.keyDown(window, { code: 'KeyK' });
  fireEvent.keyDown(window, { code: 'KeyL' });
  expect(screen.getByText('Recording… J + K + L')).toBeInTheDocument();
  fireEvent.keyUp(window, { code: 'KeyJ' });
  expect(screen.getByText('J + K + L')).toBeInTheDocument();
  expect(screen.getByTestId('state')).toHaveTextContent('"keys":["j","k","l"]');
});

it('edits layer scope without losing the all-layer default', () => {
  render(<Harness initial={[setWithChords([])]} />);
  fireEvent.click(screen.getByLabelText('All layers'));
  fireEvent.click(screen.getByLabelText('nav'));
  expect(screen.getByTestId('state')).toHaveTextContent('"layers":["base"]');
  fireEvent.click(screen.getByLabelText('base'));
  expect(screen.getByTestId('state')).toHaveTextContent('"layers":["base"]');
  expect(screen.getByLabelText('All layers')).not.toBeChecked();
});

it('shows a conflict for duplicate active physical combinations', () => {
  render(<Harness initial={[setWithChords([
    { keys: ['j', 'k'], action: { type: 'key', key: 'esc' } },
    { keys: ['k', 'j'], action: { type: 'key', key: 'tab' } },
  ])]} />);
  expect(screen.getAllByText('Conflicts with another active chord')).toHaveLength(2);
});
