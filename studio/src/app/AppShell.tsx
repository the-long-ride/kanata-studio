import { RotateCcw, Settings2, Undo2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { UiMode } from '../lib/types';
import { IconButton } from '../components/IconButton';
import { StatusDot } from '../components/StatusDot';
import { ModeSwitch } from './ModeSwitch';
export function AppShell({ mode, onMode, rail, main, inspector, status = 'Running', onSettings, onUndo, onRestart, }: {
    mode: UiMode;
    onMode: (mode: UiMode) => void;
    rail: ReactNode;
    main: ReactNode;
    inspector: ReactNode;
    status?: string;
    onSettings?: () => void;
    onUndo?: () => void;
    onRestart?: () => void;
}) {
    return (<div className="app-shell">
      <header className="topbar">
        <div className="brand">Kanata Studio</div>
        <ModeSwitch value={mode} onChange={onMode}/>
        <div className="topbar-spacer"/>
        {onUndo && <IconButton label="Undo last mapping" onClick={onUndo}><Undo2 size={15}/></IconButton>}
        {onRestart && <IconButton label="Restart Kanata engine" onClick={onRestart}><RotateCcw size={15}/></IconButton>}
        {onSettings && <IconButton label="Settings" onClick={onSettings}><Settings2 size={15}/></IconButton>}
        <div className="status-inline">
          <StatusDot error={status !== 'Running'}/>
          {status}
        </div>
      </header>
      <div className="workspace">
        <aside className="rail">{rail}</aside>
        <main className="canvas">{main}</main>
        <aside className="inspector">{inspector}</aside>
      </div>
    </div>);
}
