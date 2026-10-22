// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import { crossBlockReplacement } from '../index';

vi.mock('../../utils/prism/index', () => ({
    default: {},
    walkTokens: () => null,
    loadedLanguages: new Set(),
    transformAliasToOrigin: (s: string) => s,
    loadLanguage: () => null,
    search: () => [],
}));

describe('crossBlockReplacement (#5415)', () => {
    it('cuts on the deletions the macOS editing chords produce', () => {
        expect(crossBlockReplacement('deleteContentBackward', null)).toBe('');
        expect(crossBlockReplacement('deleteContentForward', null)).toBe('');
        expect(crossBlockReplacement('deleteHardLineForward', null)).toBe('');
        expect(crossBlockReplacement('deleteWordBackward', null)).toBe('');
    });

    it('replaces the selection with the text an insertion carries', () => {
        expect(crossBlockReplacement('insertText', 'x')).toBe('x');
        expect(crossBlockReplacement('insertFromYank', 'text')).toBe('text');
        expect(crossBlockReplacement('insertReplacementText', 'their')).toBe('their');
    });

    it('still claims an edit it has never seen before', () => {
        expect(crossBlockReplacement('deleteSomethingNewChromiumAdded', null)).toBe('');
        expect(crossBlockReplacement('insertSomethingNewChromiumAdded', 'x')).toBe('x');
        expect(crossBlockReplacement('insertTranspose', null)).toBe('');
    });

    it('leaves cut, drag, paste, Enter and composition to the handlers that own them', () => {
        expect(crossBlockReplacement('deleteByCut', null)).toBeNull();
        expect(crossBlockReplacement('deleteByDrag', null)).toBeNull();
        expect(crossBlockReplacement('insertFromDrop', null)).toBeNull();
        expect(crossBlockReplacement('insertFromPaste', null)).toBeNull();
        expect(crossBlockReplacement('insertFromPasteAsQuotation', null)).toBeNull();
        expect(crossBlockReplacement('insertParagraph', null)).toBeNull();
        expect(crossBlockReplacement('insertLineBreak', null)).toBeNull();
        expect(crossBlockReplacement('insertCompositionText', 'a')).toBeNull();
        expect(crossBlockReplacement('deleteCompositionText', null)).toBeNull();
    });

    it('never deletes for a formatting or history command', () => {
        expect(crossBlockReplacement('formatBold', null)).toBeNull();
        expect(crossBlockReplacement('formatItalic', null)).toBeNull();
        expect(crossBlockReplacement('historyUndo', null)).toBeNull();
        expect(crossBlockReplacement('historyRedo', null)).toBeNull();
    });
});
