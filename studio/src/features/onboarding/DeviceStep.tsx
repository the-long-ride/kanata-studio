import { Button } from '../../components/Button';
import type { CapabilitySet, KeyboardDevice } from '../../lib/types';

export function DeviceStep({
  devices,
  capabilities,
  onNext,
}: {
  devices: KeyboardDevice[];
  capabilities: CapabilitySet;
  onNext: () => void;
}) {
  return (
    <>
      <h2>Your keyboards</h2>
      <p className="sub">Detected devices and setup status.</p>
      <div className="device-list">
        {devices.length === 0 ? (
          <div><small>No keyboards detected yet.</small></div>
        ) : (
          devices.map((device) => (
            <div key={device.id}>
              <b>{device.name}</b>
              <small>{device.manualLayout ?? device.layout}</small>
            </div>
          ))
        )}
      </div>
      {capabilities.perDeviceMapping === 'RequiresWindowsInterception' && (
        <p className="warning">
          Per-keyboard profiles on Windows require Kanata&apos;s Interception backend and driver.
        </p>
      )}
      {Object.entries(capabilities.permissions)
        .filter(([, ok]) => !ok)
        .map(([name]) => (
          <p className="warning" key={name}>Setup required: {name}</p>
        ))}
      <Button className="primary" onClick={onNext}>Continue</Button>
    </>
  );
}
