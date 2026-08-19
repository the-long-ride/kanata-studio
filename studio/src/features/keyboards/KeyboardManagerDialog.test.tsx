import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { KeyboardVisualPreset } from '../../lib/types';
import { KeyboardManagerDialog } from './KeyboardManagerDialog';

afterEach(cleanup);

function renderManager(
  reportedKeyCount: number,
  visualPreset?: KeyboardVisualPreset,
  visualPresetOverride: KeyboardVisualPreset | null = null,
) {
  const keyboard = {
    id: 'kbd-1',
    name: 'My keyboard',
    detectedName: 'Windows keyboard',
    configured: true,
    connected: true,
    layout: 'Ansi' as const,
    visualPreset,
    visualPresetOverride,
    layoutOverride: null,
    vendorId: 0x1234,
    productId: 0x5678,
    reportedKeyCount,
    functionKeyCount: 12,
    keyboardType: 4,
  };
  render(<KeyboardManagerDialog
    open
    keyboard={keyboard}
    items={[keyboard]}
    onClose={() => {}}
    onSetup={vi.fn(async () => {})}
    onUpdate={vi.fn(async () => {})}
    onCopy={vi.fn(async () => {})}
    onRefresh={vi.fn(async () => {})}
  />);
}

it('labels metadata-inferred full size Auto geometry', () => {
  renderManager(104, 'fullsize');
  expect(screen.getByRole('option', { name: 'Auto (Full size · 104 keys)' })).toBeInTheDocument();
});

it('labels unresolved Auto geometry as Generic Extended', () => {
  renderManager(87);
  expect(screen.getByRole('option', { name: 'Auto (Generic Extended · 87 keys)' })).toBeInTheDocument();
});

it('describes Auto inference instead of the current manual override', () => {
  renderManager(104, '65', '65');
  expect(screen.getByRole('option', { name: 'Auto (Full size · 104 keys)' })).toBeInTheDocument();
});
