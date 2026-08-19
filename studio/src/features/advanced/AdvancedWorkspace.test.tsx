import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StudioProfile } from '../../lib/types';
import { AdvancedWorkspace } from './AdvancedWorkspace';

afterEach(cleanup);

function profile(): StudioProfile {
  return {
    id: 'global', revision: 0, name: 'Global', enabled: true,
    deviceTarget: { kind: 'all' },
    source: {
      kind: 'visual', mappings: { a: { type: 'key', key: 'a' } },
      advanced: {
        layers: [{ name: 'nav', mappings: {} }],
        chordSets: [{
          name: 'Editing', timeoutMs: 50, layers: [],
          chords: [{ keys: ['j', 'k'], action: { type: 'key', key: 'esc' } }],
        }],
      },
    },
  };
}

describe('AdvancedWorkspace sidebar behavior', () => {
  it('owns Layers and Chords without rendering a second keyboard', () => {
    const onLayer = vi.fn();
    render(<AdvancedWorkspace
      profile={profile()}
      layout="Ansi"
      activeLayer="base"
      direct={{}}
      inherited={{}}
      onSelectKey={() => undefined}
      onLayer={onLayer}
      onAddLayer={() => undefined}
      onChordSetsChange={() => undefined}
      onSelectChord={() => undefined}
      onConvertRaw={() => undefined}
      onRawValidate={async () => ({ ok: true })}
      onRawApply={async () => undefined}
      onPreview={() => undefined}
    />);

    expect(screen.getByRole('button', { name: 'Layers' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Chords' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'A' })).toBeNull();

    fireEvent.click(screen.getByText('nav'));
    expect(onLayer).toHaveBeenCalledWith('nav');
    fireEvent.click(screen.getByRole('button', { name: 'Chords' }));
    expect(screen.getByText('Chord Sets')).toBeTruthy();
  });
});
