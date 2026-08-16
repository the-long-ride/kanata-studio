import type { StudioProfile } from '../../lib/types';
import { ProfileRow } from './ProfileRow';
import { Button } from '../../components/Button';
import './profiles.css';
export function ProfileRail({ profiles, selected, onSelect, onCreate }: {
    profiles: StudioProfile[];
    selected: string;
    onSelect: (id: string) => void;
    onCreate: () => void;
}) { const sorted = [...profiles].sort((a, b) => a.name === 'Global' ? -1 : b.name === 'Global' ? 1 : a.name.localeCompare(b.name)); return <><div className="panel-title">Profiles</div><div className="profile-list">{sorted.map(p => <ProfileRow key={p.id} profile={p} active={selected === p.id} onSelect={() => onSelect(p.id)}/>)}</div><div className="profile-add"><Button onClick={onCreate}>+ New profile</Button></div></>; }
