import type { ActionSpec } from '../../lib/types';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { KeyInspector } from './KeyInspector';

export function KeySettingsModal({
  keyId,
  action,
  directAction,
  inheritedAction,
  onChange,
  onReset,
  onClose,
  status = 'Applied',
  hardwareControlled = false,
}: {
  keyId?: string;
  action?: ActionSpec;
  directAction?: ActionSpec;
  inheritedAction?: ActionSpec;
  onChange: (action: ActionSpec) => void;
  onReset: () => void;
  onClose: () => void;
  status?: string;
  hardwareControlled?: boolean;
}) {
  if (!keyId) return null;
  const title = `${keyId.length === 1 ? keyId.toUpperCase() : keyId} key settings`;
  return <Modal title={title} onClose={onClose} className="key-settings-dialog">
    <div className="key-setting-state">
      {hardwareControlled
        ? <span>Hardware-controlled</span>
        : directAction ? <span>Direct override</span>
          : inheritedAction ? <span>Inherited mapping</span>
            : <span>Default mapping</span>}
    </div>
    {hardwareControlled
      ? <p className="muted">This Fn key is handled by keyboard firmware and is not exposed to Kanata.</p>
      : <KeyInspector keyId={keyId} action={action} onChange={onChange} status={status} />}
    <div className="dialog-actions">
      <Button type="button" onClick={onClose}>Close</Button>
      <Button type="button" disabled={hardwareControlled || !directAction} onClick={onReset}>Reset to default</Button>
    </div>
  </Modal>;
}
