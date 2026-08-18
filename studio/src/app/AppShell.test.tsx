import type { ComponentType } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';

const Shell = AppShell as unknown as ComponentType<Record<string, unknown>>;

describe('AppShell', () => {
  it('uses Beginner and Advanced labels and preserves shell state', () => {
    let mode: 'Beginner' | 'Advanced' = 'Beginner';
    const { rerender } = render(
      <AppShell mode={mode} onMode={m => { mode = m; }} rail="rail" main="main" inspector="inspector" />,
    );
    expect(screen.getByText('Beginner')).toBeTruthy();
    expect(screen.getByText('Advanced')).toBeTruthy();
    fireEvent.click(screen.getByText('Advanced'));
    rerender(
      <AppShell mode={mode} onMode={m => { mode = m; }} rail="rail" main="main" inspector="inspector" />,
    );
    expect(screen.queryByText('I am keyboard wizard')).toBeNull();
  });

  it('renders custom window controls and resizable pane separators', () => {
    const onPaneWidthsChange = vi.fn();
    render(
      <Shell
        mode="Beginner"
        onMode={() => undefined}
        rail="rail"
        main="main"
        inspector="inspector"
        leftRailWidth={260}
        rightPaneWidth={340}
        onPaneWidthsChange={onPaneWidthsChange}
      />,
    );
    expect(screen.getByRole('button', { name: 'Minimize window' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Maximize window' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close window' })).toBeTruthy();
    const left = screen.getByRole('separator', { name: 'Resize profile sidebar' });
    const right = screen.getByRole('separator', { name: 'Resize inspector sidebar' });
    fireEvent.doubleClick(left);
    fireEvent.doubleClick(right);
    expect(onPaneWidthsChange).toHaveBeenCalledWith(260, 340);
  });
});
