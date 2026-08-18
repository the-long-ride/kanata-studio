export type UiMode = 'Beginner' | 'Advanced';
export type KeyboardLayout = 'Ansi' | 'Iso' | 'Jis' | 'Unknown';
export type KeyboardVisualPreset = 'fullsize' | 'tkl' | '75' | '65' | '60';
export type RuntimeHealth = 'Running' | 'Paused' | 'Recovering' | {
    RecoveryRequired: {
        message: string;
    };
};
export type DeviceTarget = {
    kind: 'all';
} | {
    kind: 'device';
    id: string;
};
export type AppMatcher = {
    executable: string;
    windowTitleContains?: string | null;
};
export type Modifier = 'Ctrl' | 'Shift' | 'Alt' | 'Meta';
export type MediaAction = 'PlayPause' | 'Next' | 'Previous' | 'VolumeUp' | 'VolumeDown' | 'Mute';
export type ActionSpec = {
    type: 'key';
    key: string;
} | {
    type: 'shortcut';
    modifiers: Modifier[];
    key: string;
} | {
    type: 'text';
    text: string;
} | {
    type: 'launchApp';
    path: string;
    args: string[];
} | {
    type: 'openUrl';
    url: string;
} | {
    type: 'media';
    action: MediaAction;
} | {
    type: 'delay';
    ms: number;
} | {
    type: 'disabled';
} | {
    type: 'advanced';
    action: AdvancedActionSpec;
};
export type AdvancedActionSpec = {
    type: 'rawAction';
    expression: string;
} | {
    type: 'tapHold';
    tap: ActionSpec;
    hold: ActionSpec;
    timeoutMs: number;
} | {
    type: 'macro';
    actions: ActionSpec[];
} | {
    type: 'multi';
    actions: ActionSpec[];
} | {
    type: 'tapDance';
    timeoutMs: number;
    actions: ActionSpec[];
} | {
    type: 'layerMomentary';
    layer: string;
} | {
    type: 'layerSwitch';
    layer: string;
};
export type ChordEntry = {
    keys: string[];
    action: ActionSpec;
};
export type ChordSet = {
    name: string;
    timeoutMs: number;
    layers: string[];
    chords: ChordEntry[];
};
export type AdvancedVisualConfig = {
    layers: Array<{
        name: string;
        mappings: Record<string, ActionSpec>;
    }>;
    chordSets?: ChordSet[];
};
export type ProfileSource = {
    kind: 'visual';
    mappings: Record<string, ActionSpec>;
    advanced: AdvancedVisualConfig;
} | {
    kind: 'raw';
    kbd: string;
};
export type StudioProfile = {
    id: string;
    revision: number;
    name: string;
    enabled: boolean;
    appMatcher?: AppMatcher | null;
    deviceTarget: DeviceTarget;
    source: ProfileSource;
};
export type KeyboardDevice = {
    id: string;
    name: string;
    vendorId?: number | null;
    productId?: number | null;
    path?: string | null;
    interfacePaths?: string[];
    layout: KeyboardLayout;
    manualLayout?: KeyboardLayout | null;
};

export type ConfiguredKeyboard = {
    id: string;
    name: string;
    detectedName: string;
    vendorId?: number | null;
    productId?: number | null;
    layoutOverride?: KeyboardLayout | null;
    visualPresetOverride?: KeyboardVisualPreset | null;
};
export type KeyboardConfigurationResult = {
    keyboard: ConfiguredKeyboard;
    profiles: StudioProfile[];
};
export type DeviceMappingCapability = 'Unavailable' | 'Available' | 'RequiresWindowsInterception';
export type CapabilitySet = {
    platform: 'Windows' | 'Macos' | 'Linux';
    perAppAutoSwitch: boolean;
    perDeviceMapping: DeviceMappingCapability;
    windowTitleMatching: boolean;
    manualProfileSelection: boolean;
    permissions: Record<string, boolean>;
};
export type StudioSettings = {
    onboardingCompleted: boolean;
    startWithSystem: boolean;
    remappingEnabled: boolean;
    stopKanataOnQuit: boolean;
    deviceLayoutOverrides: Record<string, KeyboardLayout>;
    uiMode: UiMode;
    leftRailWidth?: number;
    rightPaneWidth?: number;
};
export type ValidationResult = {
    ok: boolean;
    message?: string | null;
    span?: {
        line: number;
        column: number;
        length?: number | null;
    } | null;
};
export type EngineStatus = {
    id: string;
    state: 'Starting' | 'Running' | 'Stopped' | 'Crashed' | 'RecoveryRequired';
    profile?: string | null;
    device?: string | null;
    message?: string | null;
};
export type BootstrapState = {
    profiles: StudioProfile[];
    settings: StudioSettings;
    devices: KeyboardDevice[];
    configuredKeyboards: ConfiguredKeyboard[];
    capabilities: CapabilitySet;
    engineStatuses: EngineStatus[];
    activeProfileId: string;
    health: RuntimeHealth;
    version: {
        studio: string;
        kanata: string;
        sha: string;
    };
};
export type ApplyResult = {
    profile: StudioProfile;
    validation: ValidationResult;
    engineStatuses: EngineStatus[];
    applied: boolean;
};