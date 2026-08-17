import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeneralSettings } from './GeneralSettings';

afterEach(cleanup);

describe('GeneralSettings', () => {
  it('renders the quit engine toggle and reports changes', () => {
    const onQuitPolicy = vi.fn();
    render(
      <GeneralSettings
        start={true}
        stopKanataOnQuit={true}
        onStart={() => undefined}
        onStopKanataOnQuit={onQuitPolicy}
      />,
    );
    const toggle = screen.getByRole('checkbox', {
      name: 'Stop Kanata engine when Kanata Studio quits',
    });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(onQuitPolicy).toHaveBeenCalledWith(false);
  });
});
