import type { StudioProfile } from '../../lib/types';
export function ProfileRow({ profile, active, onSelect }: {
    profile: StudioProfile;
    active: boolean;
    onSelect: () => void;
}) { const device = profile.deviceTarget.kind === 'device' ? 'device' : ''; return <button className={`profile-row ${active ? 'active' : ''}`} onClick={onSelect}><span>{profile.name}</span>{profile.appMatcher && <small>{profile.appMatcher.executable}</small>}{device && <em>⌨</em>}</button>; }
