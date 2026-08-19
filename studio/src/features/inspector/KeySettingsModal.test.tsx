import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ActionSpec } from '../../lib/types';
import * as moduleUnderTest from './KeySettingsModal';

const KeySettingsModal = (moduleUnderTest as unknown as { KeySettingsModal?: React.ComponentType<Record<string, unknown>> }).KeySettingsModal;
afterEach(cleanup);

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

  it('edits Advanced actions inside the compact modal', () => {
    expect(KeySettingsModal).toBeTruthy();
    if (!KeySettingsModal) return;
    const action: ActionSpec = {
      type: 'advanced',
      action: { type: 'tapHold', tap: { type: 'key', key: 'esc' }, hold: { type: 'key', key: 'lctl' }, timeoutMs: 200 },
    };
    render(<KeySettingsModal
      keyId="caps"
      action={action}
      advanced
      onChange={() => undefined}
      onReset={() => undefined}
      onClose={() => undefined}
    />);
    expect(screen.getByText('Tap key')).toBeTruthy();
    expect(screen.getByText('Hold key')).toBeTruthy();
  });

  it('supports chord action titles without a key reset button', () => {
    expect(KeySettingsModal).toBeTruthy();
    if (!KeySettingsModal) return;
    render(<KeySettingsModal
      keyId="J + K"
      title="J + K chord action"
      action={{ type: 'key', key: 'esc' }}
      advanced
      onChange={() => undefined}
      onClose={() => undefined}
    />);
    expect(screen.getByRole('dialog', { name: 'J + K chord action' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reset to default' })).toBeNull();
  });
});
