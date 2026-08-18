import { Minus, RotateCcw, Settings2, Square, Undo2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import type { UiMode } from '../lib/types';
import { IconButton } from '../components/IconButton';
import { StatusDot } from '../components/StatusDot';
import { ModeSwitch } from './ModeSwitch';
import { closeWindow, minimizeWindow, startWindowDrag, toggleMaximizeWindow } from './windowControls';

const DEFAULT_LEFT = 260;
const DEFAULT_RIGHT = 340;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function AppShell({
  mode, onMode, keyboardControl, rail, main, inspector,
  status = 'Running', onSettings, onUndo, onRestart,
  leftRailWidth = DEFAULT_LEFT, rightPaneWidth = DEFAULT_RIGHT, onPaneWidthsChange,
}: {
  mode: UiMode;
  onMode: (mode: UiMode) => void;
  keyboardControl?: ReactNode;
  rail: ReactNode;
  main: ReactNode;
  inspector: ReactNode;
  status?: string;
  onSettings?: () => void;
  onUndo?: () => void;
  onRestart?: () => void;
  leftRailWidth?: number;
  rightPaneWidth?: number;
  onPaneWidthsChange?: (left: number, right: number) => void;
}) {
  const drag = useRef<{ side: 'left' | 'right'; x: number; left: number; right: number }>();
  const onPointerMove = useCallback((event: PointerEvent) => {
    if (!drag.current || !onPaneWidthsChange) return;
    const delta = event.clientX - drag.current.x;
    if (drag.current.side === 'left') {
      onPaneWidthsChange(clamp(drag.current.left + delta, 180, 420), drag.current.right);
    } else {
      onPaneWidthsChange(drag.current.left, clamp(drag.current.right - delta, 260, 520));
    }
  }, [onPaneWidthsChange]);
  const stopDrag = useCallback(() => { drag.current = undefined; }, []);

  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stopDrag);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', stopDrag);
    };
  }, [onPointerMove, stopDrag]);

  const startResize = (side: 'left' | 'right', event: React.PointerEvent) => {
    drag.current = { side, x: event.clientX, left: leftRailWidth, right: rightPaneWidth };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand-drag" type="button" aria-label="Drag window" onMouseDown={() => void startWindowDrag()}>
        <span className="brand-logo" aria-hidden="true">K</span><span className="brand">Kanata Studio</span>
      </button>
      {keyboardControl}
      <ModeSwitch value={mode} onChange={onMode} />
      <div className="topbar-spacer" data-tauri-drag-region />
      {onUndo && <IconButton label="Undo last mapping" onClick={onUndo}><Undo2 size={15} /></IconButton>}
      {onRestart && <IconButton label="Restart Kanata engine" onClick={onRestart}><RotateCcw size={15} /></IconButton>}
      {onSettings && <IconButton label="Settings" onClick={onSettings}><Settings2 size={15} /></IconButton>}
      <div className="status-inline"><StatusDot error={status !== 'Running'} />{status}</div>
      <div className="window-controls">
        <button type="button" aria-label="Minimize window" onClick={() => void minimizeWindow()}><Minus size={14} /></button>
        <button type="button" aria-label="Maximize window" onClick={() => void toggleMaximizeWindow()}><Square size={12} /></button>
        <button type="button" className="window-close" aria-label="Close window" onClick={() => void closeWindow()}><X size={14} /></button>
      </div>
    </header>
    <div
      className="workspace"
      style={{
        '--left-rail-width': `${clamp(leftRailWidth, 180, 420)}px`,
        '--right-pane-width': `${clamp(rightPaneWidth, 260, 520)}px`,
      } as React.CSSProperties}
    >
      <aside className="rail">{rail}</aside>
      <div
        className="pane-splitter"
        role="separator"
        aria-label="Resize profile sidebar"
        onPointerDown={event => startResize('left', event)}
        onDoubleClick={() => onPaneWidthsChange?.(DEFAULT_LEFT, DEFAULT_RIGHT)}
      />
      <main className="canvas">{main}</main>
      <div
        className="pane-splitter"
        role="separator"
        aria-label="Resize inspector sidebar"
        onPointerDown={event => startResize('right', event)}
        onDoubleClick={() => onPaneWidthsChange?.(DEFAULT_LEFT, DEFAULT_RIGHT)}
      />
      <aside className="inspector">{inspector}</aside>
    </div>
  </div>;
}
