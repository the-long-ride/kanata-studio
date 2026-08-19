import type {
  ConfiguredKeyboard,
  DeviceTarget,
  KeyboardDevice,
  KeyboardLayout,
  KeyboardVisualPreset,
} from '../../lib/types';

export type KeyboardCatalogItem = {
  id: string;
  name: string;
  detectedName: string;
  configured: boolean;
  connected: boolean;
  layout: KeyboardDevice['layout'];
  layoutOverride?: KeyboardDevice['manualLayout'];
  visualPreset?: KeyboardVisualPreset;
  visualPresetOverride?: KeyboardVisualPreset | null;
  vendorId?: number | null;
  productId?: number | null;
  reportedKeyCount?: number | null;
  functionKeyCount?: number | null;
  keyboardType?: number | null;
};

type VisualPresetInput = {
  override?: KeyboardVisualPreset | null;
  name: string;
  layout: KeyboardLayout | string;
  reportedKeyCount?: number | null;
  functionKeyCount?: number | null;
  keyboardType?: number | null;
};

export function resolveVisualPreset(input: VisualPresetInput): KeyboardVisualPreset | undefined {
  if (input.override) return input.override;
  const name = input.name.toLowerCase();
  if (/\b(tkl|tenkeyless)\b|keychron\s*k8\b/.test(name)) return 'tkl';
  if (/\b75\b|air\s*75|air75|keychron\s*k2\b|keychron\s*q1\b/.test(name)) return '75';
  if (/\b65\b|keychron\s*k6\b|keychron\s*q2\b/.test(name)) return '65';
  if (/\b60\b|poker|anne\s*pro/.test(name)) return '60';
  const keyCount = input.reportedKeyCount ?? -1;
  if ([101, 102, 104, 105].includes(keyCount)) return 'fullsize';
  if (input.keyboardType === 0x7 && [106, 109].includes(keyCount)) return 'fullsize';
  return undefined;
}

function visualPresetForDevice(
  device: KeyboardDevice | undefined,
  name: string,
  layout: KeyboardLayout | string,
  override?: KeyboardVisualPreset | null,
) {
  return resolveVisualPreset({
    override,
    name,
    layout,
    reportedKeyCount: device?.reportedKeyCount,
    functionKeyCount: device?.functionKeyCount,
    keyboardType: device?.keyboardType,
  });
}

export function buildKeyboardCatalog(
  configured: ConfiguredKeyboard[],
  detected: KeyboardDevice[],
): KeyboardCatalogItem[] {
  const detectedById = new Map(detected.map(device => [device.id, device]));
  const saved = configured.map(keyboard => {
    const device = detectedById.get(keyboard.id);
    detectedById.delete(keyboard.id);
    const layout = device?.layout ?? keyboard.layoutOverride ?? 'Unknown';
    const detectedName = device?.name ?? keyboard.detectedName;
    return {
      id: keyboard.id,
      name: keyboard.name,
      detectedName,
      configured: true,
      connected: Boolean(device),
      layout,
      layoutOverride: keyboard.layoutOverride ?? device?.manualLayout ?? null,
      visualPresetOverride: keyboard.visualPresetOverride ?? null,
      visualPreset: visualPresetForDevice(
        device,
        detectedName,
        layout,
        keyboard.visualPresetOverride,
      ),
      vendorId: device?.vendorId ?? keyboard.vendorId,
      productId: device?.productId ?? keyboard.productId,
      reportedKeyCount: device?.reportedKeyCount,
      functionKeyCount: device?.functionKeyCount,
      keyboardType: device?.keyboardType,
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
    visualPresetOverride: null,
    visualPreset: visualPresetForDevice(device, device.name, device.layout),
    vendorId: device.vendorId,
    productId: device.productId,
    reportedKeyCount: device.reportedKeyCount,
    functionKeyCount: device.functionKeyCount,
    keyboardType: device.keyboardType,
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
