import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ActionSpec } from '../../lib/types';
import * as moduleUnderTest from './KeySettingsModal';

const KeySettingsModal = (moduleUnderTest as unknown as { KeySettingsModal?: React.ComponentType<Record<string, unknown>> }).KeySettingsModal;

describe('KeySettingsModal', () => {
  it('shows direct/inherited state and resets the direct override', () => {
    expect(KeySettingsModal).toBeTruthy();
    if (!KeySettingsModal) return;
    const onReset = vi.fn();
    const directAction: ActionSpec = { type: 'key', key: 'esc' };
    const inheritedAction: ActionSpec = { type: 'key', key: 'a' };
    render(<KeySettingsModal
      keyId="a"
      action={directAction}
      directAction={directAction}
      inheritedAction={inheritedAction}
      onChange={() => undefined}
      onReset={onReset}
      onClose={() => undefined}
      status="Applied"
    />);
    expect(screen.getByRole('dialog', { name: 'A key settings' })).toBeTruthy();
    expect(screen.getByText('Direct override')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reset to default' }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
