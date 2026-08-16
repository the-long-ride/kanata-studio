import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Select } from '../../components/Select';
import type {
  DeviceMappingCapability,
  KeyboardDevice,
} from '../../lib/types';

export type NewProfileInput = {
  name: string;
  executable: string;
  deviceId?: string;
};

type Props = {
  open: boolean;
  devices: KeyboardDevice[];
  specificDeviceEnabled: boolean;
  deviceCapability: DeviceMappingCapability;
  onClose: () => void;
  onCreate: (input: NewProfileInput) => void;
};

export function CreateProfileDialog({
  open,
  devices,
  specificDeviceEnabled,
  deviceCapability,
  onClose,
  onCreate,
}: Props) {
  const [name, setName] = useState('');
  const [executable, setExecutable] = useState('');
  const [deviceId, setDeviceId] = useState('all');

  useEffect(() => {
    if (!open) return;
    setName('');
    setExecutable('');
    setDeviceId('all');
  }, [open]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="dialog"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (!executable.trim()) return;
          onCreate({
            name: name.trim() || executable.trim(),
            executable: executable.trim(),
            deviceId: specificDeviceEnabled && deviceId !== 'all' ? deviceId : undefined,
          });
        }}
      >
        <h3>New app profile</h3>
        <label className="field">
          Name
          <input
            className="ui-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="field">
          Executable
          <input
            className="ui-input"
            value={executable}
            onChange={(event) => setExecutable(event.target.value)}
            placeholder="Code.exe"
            autoFocus
          />
        </label>
        <label className="field">
          Keyboard
          <Select
            value={deviceId}
            disabled={!specificDeviceEnabled}
            onChange={(event) => setDeviceId(event.target.value)}
          >
            <option value="all">All keyboards</option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>{device.name}</option>
            ))}
          </Select>
        </label>
        {!specificDeviceEnabled && (
          <p className="muted compact-note">{deviceCapabilityMessage(deviceCapability)}</p>
        )}
        <div className="dialog-actions">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button className="primary" disabled={!executable.trim()}>Create</Button>
        </div>
      </form>
    </div>
  );
}

function deviceCapabilityMessage(capability: DeviceMappingCapability): string {
  if (capability === 'RequiresWindowsInterception') {
    return 'Specific keyboards require the Windows Interception backend. All keyboards is available now.';
  }

  return 'This Kanata backend cannot target one physical keyboard on this system.';
}
