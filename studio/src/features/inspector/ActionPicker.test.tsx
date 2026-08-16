import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ActionPicker, beginnerActions } from './ActionPicker';
describe('ActionPicker', () => {
    it('exposes exactly approved Beginner actions', () => {
        render(<ActionPicker action={{ type: 'disabled' }} onChange={() => { }}/>);
        for (const x of beginnerActions)
            expect(screen.getByRole('option', { name: x })).toBeTruthy();
        for (const x of ['Command', 'Script', 'Macro', 'Mouse', 'Layer'])
            expect(screen.queryByRole('option', { name: x })).toBeNull();
    });
});
