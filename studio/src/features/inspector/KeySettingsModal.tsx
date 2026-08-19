import type { ActionSpec } from '../../lib/types';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { AdvancedInspector } from '../advanced/AdvancedInspector';
import { KeyInspector } from './KeyInspector';

export function KeySettingsModal({
  keyId,
  title,
  action,
  directAction,
  inheritedAction,
  onChange,
  onReset,
  onClose,
  status = 'Applied',
  hardwareControlled = false,
  advanced = false,
  stateLabel,
}: {
  keyId?: string;
  title?: string;
  action?: ActionSpec;
  directAction?: ActionSpec;
  inheritedAction?: ActionSpec;
  onChange: (action: ActionSpec) => void;
  onReset?: () => void;
  onClose: () => void;
  status?: string;
  hardwareControlled?: boolean;
  advanced?: boolean;
  stateLabel?: string;
}) {
  if (!keyId) return null;
  const defaultTitle = `${keyId.length === 1 ? keyId.toUpperCase() : keyId} key settings`;
  const mappingState = stateLabel ?? (hardwareControlled
    ? 'Hardware-controlled'
    : directAction ? 'Direct override'
      : inheritedAction ? 'Inherited mapping'
        : 'Default mapping');
  return <Modal title={title ?? defaultTitle} onClose={onClose} className="key-settings-dialog">
    <div className="key-setting-state"><span>{mappingState}</span></div>
    {hardwareControlled
      ? <p className="muted">This Fn key is handled by keyboard firmware and is not exposed to Kanata.</p>
      : advanced
        ? <AdvancedInspector keyId={keyId} action={action} onChange={onChange} status={status} />
        : <KeyInspector keyId={keyId} action={action} onChange={onChange} status={status} />}
    <div className="dialog-actions">
      <Button type="button" onClick={onClose}>Close</Button>
      {onReset && <Button type="button" disabled={hardwareControlled || !directAction} onClick={onReset}>Reset to default</Button>}
    </div>
  </Modal>;
}
