import type { StudioProfile } from '../../lib/types';
import { LayerRail } from './LayerRail';
export function AdvancedVisual({ profile }: {
    profile: StudioProfile;
}) {
    if (profile.source.kind === 'raw')
        return <div className="empty-inspector">Raw profile is authoritative.</div>;
    const layers = ['base', ...profile.source.advanced.layers.map(l => l.name)];
    return <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', height: '100%' }}><LayerRail layers={layers} active="base" onSelect={() => { }} onAdd={() => { }}/><div className="keyboard-wrap"><p>Advanced visual editor — layers, tap-hold, macros and actions.</p></div></div>;
}
