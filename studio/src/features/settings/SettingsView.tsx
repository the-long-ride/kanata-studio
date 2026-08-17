import type { BootstrapState } from '../../lib/types';
import type { KeyboardCatalogItem } from '../keyboards/keyboardCatalog';
import { GeneralSettings } from './GeneralSettings';
import { KeyboardSettings } from './KeyboardSettings';
import { UpdatesSettings } from './UpdatesSettings';

export function SettingsView({
  state,
  keyboards,
  onStart,
  onStopKanataOnQuit,
  onManageKeyboard,
  onUpdate,
}: {
  state: BootstrapState;
  keyboards: KeyboardCatalogItem[];
  onStart: (value: boolean) => void;
  onStopKanataOnQuit: (value: boolean) => void;
  onManageKeyboard: (id: string) => void;
  onUpdate: () => void;
}) {
  return <div className="settings-page">
    <GeneralSettings
      start={state.settings.startWithSystem}
      stopKanataOnQuit={state.settings.stopKanataOnQuit}
      onStart={onStart}
      onStopKanataOnQuit={onStopKanataOnQuit}
    />
    <KeyboardSettings keyboards={keyboards} onManage={onManageKeyboard} />
    <UpdatesSettings version={state.version} onCheck={onUpdate} />
  </div>;
}
