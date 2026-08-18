import type { ComponentType } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';
import * as windowControls from './windowControls';

vi.mock('./windowControls', () => ({
  minimizeWindow: vi.fn(),
  toggleMaximizeWindow: vi.fn(),
  closeWindow: vi.fn(),
  startWindowDrag: vi.fn(),
}));

const Shell = AppShell as unknown as ComponentType<Record<string, unknown>>;
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

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

  it('wires custom window controls and title drag behavior', () => {
    render(<AppShell mode="Beginner" onMode={() => undefined} rail="rail" main="main" inspector="inspector" />);
    fireEvent.click(screen.getByRole('button', { name: 'Minimize window' }));
    fireEvent.click(screen.getByRole('button', { name: 'Maximize window' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close window' }));
    const drag = screen.getByRole('button', { name: 'Drag window' });
    fireEvent.mouseDown(drag);
    fireEvent.doubleClick(drag);
    expect(windowControls.minimizeWindow).toHaveBeenCalledOnce();
    expect(windowControls.toggleMaximizeWindow).toHaveBeenCalledTimes(2);
    expect(windowControls.closeWindow).toHaveBeenCalledOnce();
    expect(windowControls.startWindowDrag).toHaveBeenCalled();
  });

  it('resets only the pane beside each separator', () => {
    const onPaneWidthsChange = vi.fn();
    render(
      <Shell
        mode="Beginner"
        onMode={() => undefined}
        rail="rail"
        main="main"
        inspector="inspector"
        leftRailWidth={300}
        rightPaneWidth={410}
        onPaneWidthsChange={onPaneWidthsChange}
      />,
    );
    fireEvent.doubleClick(screen.getByRole('separator', { name: 'Resize profile sidebar' }));
    expect(onPaneWidthsChange).toHaveBeenLastCalledWith(260, 410);
    fireEvent.doubleClick(screen.getByRole('separator', { name: 'Resize inspector sidebar' }));
    expect(onPaneWidthsChange).toHaveBeenLastCalledWith(300, 340);
  });
});
