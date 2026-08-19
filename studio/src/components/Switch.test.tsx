import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Switch } from './Switch';

afterEach(cleanup);

it('exposes an accessible checkbox and reports the next checked state', () => {
  const onChange = vi.fn();
  render(<Switch label="Start with system" checked={false} onChange={onChange} />);
  const control = screen.getByRole('checkbox', { name: 'Start with system' });
  expect(control).not.toBeChecked();
  fireEvent.click(control);
  expect(onChange).toHaveBeenCalledWith(true);
});

it('respects disabled state', () => {
  const onChange = vi.fn();
  render(<Switch label="Hardware controlled" checked={true} disabled onChange={onChange} />);
  const control = screen.getByRole('checkbox', { name: 'Hardware controlled' });
  expect(control).toBeDisabled();
  fireEvent.click(control);
  expect(onChange).not.toHaveBeenCalled();
});
