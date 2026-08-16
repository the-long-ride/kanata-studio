import type {
  DeviceMappingCapability,
  KeyboardDevice,
  StudioProfile,
} from '../lib/types';

type ProfileDeviceScope = Pick<StudioProfile, 'deviceTarget'>;

export function selectProfileDevice(
  profile: ProfileDeviceScope | undefined,
  devices: KeyboardDevice[],
): KeyboardDevice | undefined {
  const target = profile?.deviceTarget;
  if (target?.kind === 'device') {
    return devices.find((device) => device.id === target.id) ?? devices[0];
  }

  return devices[0];
}

export function canTargetSpecificDevice(
  capability: DeviceMappingCapability,
): boolean {
  return capability === 'Available';
}
