import { describe, expect, it } from 'vitest';
import icons from '../config';

// P3 defensive lock for marktext `ab97336e` (highlight `<mark>`) and
// `ef9fe756` (underline `<u>`). These shortcuts already shipped in muya
// alongside the other six inline format types, but nothing in the test
// suite asserts that they stay wired into the toolbar config — quietly
// dropping an entry would silently delete the user-visible button.
//
// The toolbar reads `config.ts` and renders one button per entry; the
// `type` string is the same key the formatHandler dispatches on, so a
// regression here would break both the UI surface and the keyboard
// shortcut path. This file locks the seven inline-format types plus
// their `icon` field so a regression has to be deliberate.
//
// Kept narrow: we do not lock tooltip/shortcut text (which is i18n /
// platform-dependent) or the `image`/`inline_math`/`clear` entries
// (which are out of scope for the highlight + underline backports).

const REQUIRED_TYPES = [
    'strong',
    'em',
    'u',
    'del',
    'mark',
    'inline_code',
    'link',
] as const;

describe('inlineFormatToolbar config — required inline format types', () => {
    it('exports an array of icon entries', () => {
        expect(Array.isArray(icons)).toBe(true);
        expect(icons.length).toBeGreaterThanOrEqual(REQUIRED_TYPES.length);
    });

    it.each(REQUIRED_TYPES)('contains an entry for type %s with an icon', (type) => {
        const entry = icons.find(i => i.type === type);
        expect(entry, `missing config entry for type=${type}`).toBeTruthy();
        expect(entry!.icon, `type=${type} entry has no icon`).toBeTruthy();
    });

    it('does not duplicate any required type', () => {
        for (const type of REQUIRED_TYPES) {
            const matches = icons.filter(i => i.type === type);
            expect(matches.length, `type=${type} appears ${matches.length} times`).toBe(1);
        }
    });
});

// marktext #3630: the inline_code / inline_math tooltips advertised Cmd/Ctrl+E
// and Shift+Cmd/Ctrl+E, but no platform binds those — the defaults are
// Cmd/Ctrl+` (inline code) and Shift+Cmd/Ctrl+M (inline math). The label must
// match the actual keybinding.
describe('inlineFormatToolbar config — shortcut labels match default keybindings (#3630)', () => {
    it('inline_code advertises the backtick key, not E', () => {
        const entry = icons.find(i => i.type === 'inline_code')!;
        expect(entry.shortcut).toContain('`');
        expect(entry.shortcut).not.toMatch(/\+E$/i);
    });

    it('inline_math advertises the M key, not E', () => {
        const entry = icons.find(i => i.type === 'inline_math')!;
        expect(entry.shortcut).toMatch(/\+M$/);
        expect(entry.shortcut).not.toMatch(/\+E$/i);
    });
});
