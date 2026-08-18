import type { BootstrapState } from '../../lib/types';
import { Modal } from '../../components/Modal';
import type { KeyboardCatalogItem } from '../keyboards/keyboardCatalog';
import { SettingsView } from './SettingsView';

export function SettingsDialog({
  open,
  onClose,
  state,
  keyboards,
  onStart,
  onStopKanataOnQuit,
  onManageKeyboard,
  onUpdate,
}: {
  open: boolean;
  onClose: () => void;
  state: BootstrapState;
  keyboards: KeyboardCatalogItem[];
  onStart: (value: boolean) => void;
  onStopKanataOnQuit: (value: boolean) => void;
  onManageKeyboard: (id: string) => void;
  onUpdate: () => void;
}) {
  return <Modal open={open} title="Settings" onClose={onClose} className="settings-dialog">
    <SettingsView
      state={state}
      keyboards={keyboards}
      onStart={onStart}
      onStopKanataOnQuit={onStopKanataOnQuit}
      onManageKeyboard={onManageKeyboard}
      onUpdate={onUpdate}
    />
  </Modal>;
}
