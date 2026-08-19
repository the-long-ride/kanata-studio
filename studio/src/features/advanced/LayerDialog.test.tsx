import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LayerDialog } from './LayerDialog';

afterEach(cleanup);

it('adds a unique trimmed layer from a modal', () => {
  const onSubmit = vi.fn();
  render(<LayerDialog open existingNames={['base', 'nav']} onClose={() => {}} onSubmit={onSubmit} />);
  expect(screen.getByRole('dialog', { name: 'Add layer' })).toBeInTheDocument();
  const input = screen.getByLabelText('Layer name');
  fireEvent.change(input, { target: { value: '  media  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add layer' }));
  expect(onSubmit).toHaveBeenCalledWith('media');
});

it('rejects empty and duplicate layer names', () => {
  render(<LayerDialog open existingNames={['base', 'Nav']} onClose={() => {}} onSubmit={() => {}} />);
  const add = screen.getByRole('button', { name: 'Add layer' });
  expect(add).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Layer name'), { target: { value: ' nav ' } });
  expect(screen.getByText('A layer with this name already exists.')).toBeInTheDocument();
  expect(add).toBeDisabled();
});
