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
  it('keeps keyboard and mode controls out of the title bar', () => {
    render(<Shell rail={<div>Sidebar controls</div>} main="main" />);
    expect(screen.getByText('Sidebar controls')).toBeTruthy();
    expect(screen.queryByText('Beginner')).toBeNull();
    expect(screen.queryByText('Advanced')).toBeNull();
  });

  it('omits the advanced sidebar and splitter when no inspector is supplied', () => {
    render(<Shell rail="rail" main="main" />);
    expect(screen.queryByRole('separator', { name: 'Resize advanced sidebar' })).toBeNull();
    expect(screen.queryByTestId('advanced-sidebar')).toBeNull();
  });

  it('renders an optional advanced sidebar and resets pane widths independently', () => {
    const onPaneWidthsChange = vi.fn();
    render(
      <Shell
        rail="rail"
        main="main"
        inspector={<div data-testid="advanced-content">advanced</div>}
        leftRailWidth={360}
        rightPaneWidth={410}
        onPaneWidthsChange={onPaneWidthsChange}
      />,
    );
    expect(screen.getByTestId('advanced-content')).toBeTruthy();
    fireEvent.doubleClick(screen.getByRole('separator', { name: 'Resize profile sidebar' }));
    expect(onPaneWidthsChange).toHaveBeenLastCalledWith(320, 410);
    fireEvent.doubleClick(screen.getByRole('separator', { name: 'Resize advanced sidebar' }));
    expect(onPaneWidthsChange).toHaveBeenLastCalledWith(360, 340);
  });

  it('wires custom window controls and title drag behavior', () => {
    render(<Shell rail="rail" main="main" />);
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
});
