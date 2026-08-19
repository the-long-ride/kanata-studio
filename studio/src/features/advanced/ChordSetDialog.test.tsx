import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ChordSet } from '../../lib/types';
import { ChordSetDialog } from './ChordSetDialog';

afterEach(cleanup);

const set: ChordSet = {
  name: 'Gaming chords',
  timeoutMs: 70,
  layers: ['nav'],
  chords: [{ keys: ['j', 'k'], action: { type: 'key', key: 'esc' } }],
};

it('edits chord-set fields in a modal with switch layer scope', () => {
  const onChange = vi.fn();
  render(<ChordSetDialog
    open
    set={set}
    setIndex={0}
    layers={['base', 'nav']}
    conflicts={new Set()}
    onChange={onChange}
    onDelete={() => {}}
    onSelectAction={() => {}}
    onClose={() => {}}
  />);
  expect(screen.getByRole('dialog', { name: 'Chord set' })).toBeInTheDocument();
  expect(screen.getByDisplayValue('Gaming chords')).toBeInTheDocument();
  expect(screen.getByLabelText('Chord timeout')).toHaveValue(70);
  expect(screen.getByRole('checkbox', { name: 'All layers' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'nav' })).toBeChecked();
  fireEvent.click(screen.getByRole('checkbox', { name: 'All layers' }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ layers: [] }));
});

it('records keys for a new chord inside the modal', () => {
  let latest = { ...set, chords: [] } satisfies ChordSet;
  const onChange = vi.fn((next: ChordSet) => { latest = next; });
  const { rerender } = render(<ChordSetDialog
    open set={latest} setIndex={0} layers={['base', 'nav']} conflicts={new Set()}
    onChange={onChange} onDelete={() => {}} onSelectAction={() => {}} onClose={() => {}}
  />);
  fireEvent.click(screen.getByRole('button', { name: 'Add chord' }));
  latest = onChange.mock.calls.at(-1)?.[0] ?? latest;
  rerender(<ChordSetDialog
    open set={latest} setIndex={0} layers={['base', 'nav']} conflicts={new Set()}
    onChange={onChange} onDelete={() => {}} onSelectAction={() => {}} onClose={() => {}}
  />);
  fireEvent.keyDown(window, { code: 'KeyJ' });
  fireEvent.keyDown(window, { code: 'KeyK' });
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
    chords: [expect.objectContaining({ keys: ['j', 'k'] })],
  }));
});
