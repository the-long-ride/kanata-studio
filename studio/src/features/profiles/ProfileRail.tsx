import type { StudioProfile } from '../../lib/types';
import { ProfileRow } from './ProfileRow';
import { Button } from '../../components/Button';
import './profiles.css';

export function ProfileRail({ profiles, selected, keyboardName, canCreate = true, onSelect, onCreate }: {
  profiles: StudioProfile[];
  selected: string;
  keyboardName?: string;
  canCreate?: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  const sorted = [...profiles].sort((a, b) => (
    !a.appMatcher ? -1 : !b.appMatcher ? 1 : a.name.localeCompare(b.name)
  ));
  return <>
    <div className="panel-title profile-rail-title">
      <span>Profiles</span>{keyboardName && <small>{keyboardName}</small>}
    </div>
    <div className="profile-list">
      {sorted.map(profile => <ProfileRow key={profile.id} profile={profile} active={selected === profile.id} onSelect={() => onSelect(profile.id)} />)}
      {!sorted.length && <p className="profile-empty">Set up this keyboard to create profiles.</p>}
    </div>
    <div className="profile-add"><Button disabled={!canCreate} onClick={onCreate}>+ New profile</Button></div>
  </>;
}
