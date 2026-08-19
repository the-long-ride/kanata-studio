import type { ReactNode } from 'react';
import type { UiMode } from '../lib/types';
import { ModeSwitch } from './ModeSwitch';

export function PrimarySidebar({
  keyboardControl,
  mode,
  onMode,
  profileRail,
}: {
  keyboardControl: ReactNode;
  mode: UiMode;
  onMode: (mode: UiMode) => void;
  profileRail: ReactNode;
}) {
  return <div className="primary-sidebar">
    <div className="primary-sidebar-controls">
      {keyboardControl}
      <ModeSwitch value={mode} onChange={onMode} />
    </div>
    <div className="primary-sidebar-profiles">{profileRail}</div>
  </div>;
}
