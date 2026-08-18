import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreateProfileDialog } from './CreateProfileDialog';

describe('CreateProfileDialog', () => {
  it('renders as an accessible modal and closes on Escape', () => {
    const onClose = vi.fn();
    render(<CreateProfileDialog onClose={onClose} onCreate={() => undefined} />);
    expect(screen.getByRole('dialog', { name: 'New app profile' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
