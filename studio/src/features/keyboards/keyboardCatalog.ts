import type {
  ConfiguredKeyboard,
  DeviceTarget,
  KeyboardDevice,
} from '../../lib/types';

export type KeyboardCatalogItem = {
  id: string;
  name: string;
  detectedName: string;
  configured: boolean;
  connected: boolean;
  layout: KeyboardDevice['layout'];
  layoutOverride?: KeyboardDevice['manualLayout'];
  vendorId?: number | null;
  productId?: number | null;
};

export function buildKeyboardCatalog(
  configured: ConfiguredKeyboard[],
  detected: KeyboardDevice[],
): KeyboardCatalogItem[] {
  const detectedById = new Map(detected.map(device => [device.id, device]));
  const saved = configured.map(keyboard => {
    const device = detectedById.get(keyboard.id);
    detectedById.delete(keyboard.id);
    return {
      id: keyboard.id,
      name: keyboard.name,
      detectedName: device?.name ?? keyboard.detectedName,
      configured: true,
      connected: Boolean(device),
      layout: device?.layout ?? keyboard.layoutOverride ?? 'Unknown',
      layoutOverride: keyboard.layoutOverride ?? device?.manualLayout ?? null,
      vendorId: device?.vendorId ?? keyboard.vendorId,
      productId: device?.productId ?? keyboard.productId,
    } satisfies KeyboardCatalogItem;
  });
  const fresh = [...detectedById.values()].map(device => ({
    id: device.id,
    name: device.name,
    detectedName: device.name,
    configured: false,
    connected: true,
    layout: device.layout,
    layoutOverride: device.manualLayout,
    vendorId: device.vendorId,
    productId: device.productId,
  } satisfies KeyboardCatalogItem));
  return [
    ...saved.sort((a, b) => a.name.localeCompare(b.name)),
    ...fresh.sort((a, b) => a.name.localeCompare(b.name)),
  ];
}


export function initialKeyboardId(
  configured: ConfiguredKeyboard[],
  detected: KeyboardDevice[],
  current?: string,
): string | undefined {
  const detectedIds = new Set(detected.map(device => device.id));
  const allIds = new Set([...configured.map(keyboard => keyboard.id), ...detectedIds]);
  if (current && allIds.has(current)) return current;
  return configured.find(keyboard => detectedIds.has(keyboard.id))?.id
    ?? configured[0]?.id
    ?? detected[0]?.id;
}

export function profilesForKeyboard<T extends { deviceTarget: DeviceTarget }>(
  profiles: T[],
  keyboardId?: string,
): T[] {
  if (!keyboardId) return [];
  return profiles.filter(profile => (
    profile.deviceTarget.kind === 'device'
    && profile.deviceTarget.id === keyboardId
  ));
}

export function keyboardGlobal<T extends {
  appMatcher?: unknown;
  deviceTarget: DeviceTarget;
}>(profiles: T[], keyboardId?: string): T | undefined {
  return profilesForKeyboard(profiles, keyboardId)
    .find(profile => !profile.appMatcher);
}
