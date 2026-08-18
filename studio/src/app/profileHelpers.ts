import type { ActionSpec, ChordSet, StudioProfile } from '../lib/types';
export function layerMappings(profile: StudioProfile | undefined, layer: string) {
    if (!profile || profile.source.kind !== 'visual')
        return {};
    if (layer === 'base')
        return profile.source.mappings;
    return profile.source.advanced.layers.find((item) => item.name === layer)?.mappings ?? {};
}
export function setLayerMapping(profile: StudioProfile, layer: string, key: string, action: ActionSpec): StudioProfile {
    if (profile.source.kind !== 'visual')
        return profile;
    if (layer === 'base') {
        return {
            ...profile,
            source: {
                ...profile.source,
                mappings: { ...profile.source.mappings, [key]: action },
            },
        };
    }
    const layers = [...profile.source.advanced.layers];
    const index = layers.findIndex((item) => item.name === layer);
    if (index < 0) {
        layers.push({ name: layer, mappings: { [key]: action } });
    }
    else {
        layers[index] = {
            ...layers[index],
            mappings: { ...layers[index].mappings, [key]: action },
        };
    }
    return {
        ...profile,
        source: {
            ...profile.source,
            advanced: { ...profile.source.advanced, layers },
        },
    };
}
export function setChordSets(profile: StudioProfile, chordSets: ChordSet[]): StudioProfile {
    if (profile.source.kind !== 'visual')
        return profile;
    return {
        ...profile,
        source: {
            ...profile.source,
            advanced: { ...profile.source.advanced, chordSets },
        },
    };
}
export function setChordAction(profile: StudioProfile, setIndex: number, chordIndex: number, action: ActionSpec): StudioProfile {
    if (profile.source.kind !== 'visual')
        return profile;
    const currentSets = profile.source.advanced.chordSets ?? [];
    const set = currentSets[setIndex];
    const chord = set?.chords[chordIndex];
    if (!set || !chord)
        return profile;
    const chords = [...set.chords];
    chords[chordIndex] = { ...chord, action };
    const chordSets = [...currentSets];
    chordSets[setIndex] = { ...set, chords };
    return setChordSets(profile, chordSets);
}
export function addLayer(profile: StudioProfile, name: string): StudioProfile {
    if (profile.source.kind !== 'visual' || !name.trim())
        return profile;
    if (profile.source.advanced.layers.some((layer) => layer.name === name))
        return profile;
    return {
        ...profile,
        source: {
            ...profile.source,
            advanced: {
                ...profile.source.advanced,
                layers: [...profile.source.advanced.layers, { name, mappings: {} }],
            },
        },
    };
}
export function makeAppProfile(name: string, executable: string, deviceId?: string): StudioProfile {
    return {
        id: `profile-${Date.now().toString(36)}`,
        revision: 0,
        name,
        enabled: true,
        appMatcher: { executable, windowTitleContains: null },
        deviceTarget: deviceId ? { kind: 'device', id: deviceId } : { kind: 'all' },
        source: {
            kind: 'visual',
            mappings: {},
            advanced: { layers: [], chordSets: [] },
        },
    };
}
