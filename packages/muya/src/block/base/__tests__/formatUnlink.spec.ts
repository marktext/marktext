import { describe, expect, it, vi } from 'vitest';
import Format from '../format';

// Regression for marktext `cb25b3d4` (PR-11b unlink port). `Format.unlink`
// rewrites the block's source text — it replaces the link's raw markdown
// (`[Anthropic](https://www.anthropic.com)`) with just the visible anchor
// text (`Anthropic`), and re-positions the caret to the end of the
// rewritten anchor. It also fires `muya-link-tools` with `reference: null`
// so the popover hides immediately after the operation.
//
// `unlink` only reads/writes `this.text`, `this.setCursor`, and
// `this.muya.eventCenter.emit`, so a structurally-typed fake `this` is
// enough — no Muya bootstrap needed (same pattern as `formatCursor.spec`).

interface IFakeFormatThis {
    text: string;
    setCursor: ReturnType<typeof vi.fn>;
    muya: { eventCenter: { emit: ReturnType<typeof vi.fn> } };
}

// `Format.prototype.unlink` is a real instance method (declared on the class)
// but isn't picked up by the public Format type when accessed via prototype.
// Cast to a record of methods to call it with a structural fake.
interface IFormatProtoUnlink { unlink: (this: IFakeFormatThis, info: { range: { start: number; end: number } | null; text: string }) => void }

function applyUnlink(text: string, range: { start: number; end: number }, anchorText: string) {
    const emit = vi.fn();
    const setCursor = vi.fn();
    const fakeThis: IFakeFormatThis = {
        text,
        setCursor,
        muya: { eventCenter: { emit } },
    };
    (Format.prototype as unknown as IFormatProtoUnlink).unlink.call(fakeThis, { range, text: anchorText });
    return { text: fakeThis.text as string, emit, setCursor };
}

describe('format.unlink — replaces link source with visible anchor', () => {
    it('markdown `[Anthropic](url)` → `Anthropic`', () => {
        const src = '[Anthropic](https://www.anthropic.com)';
        const { text } = applyUnlink(src, { start: 0, end: src.length }, 'Anthropic');
        expect(text).toBe('Anthropic');
    });

    it('keeps surrounding text intact when the link is mid-paragraph', () => {
        const src = 'see [Anthropic](https://www.anthropic.com) for details';
        const { text } = applyUnlink(src, { start: 4, end: 4 + '[Anthropic](https://www.anthropic.com)'.length }, 'Anthropic');
        expect(text).toBe('see Anthropic for details');
    });

    it('html `<a href=…>x</a>` → `x`', () => {
        const src = '<a href="https://x.com">x</a>';
        const { text } = applyUnlink(src, { start: 0, end: src.length }, 'x');
        expect(text).toBe('x');
    });

    it('reference link `[foo][bar]` → `foo`', () => {
        const src = '[foo][bar]';
        const { text } = applyUnlink(src, { start: 0, end: src.length }, 'foo');
        expect(text).toBe('foo');
    });

    it('places caret at end of the rewritten anchor', () => {
        const src = 'hi [Anthropic](https://www.anthropic.com)!';
        const { setCursor } = applyUnlink(
            src,
            { start: 3, end: 3 + '[Anthropic](https://www.anthropic.com)'.length },
            'Anthropic',
        );
        // After rewrite, anchor ends at offset 3 + 'Anthropic'.length = 12.
        expect(setCursor).toHaveBeenCalledWith(12, 12, true);
    });

    it('emits `muya-link-tools` with reference:null so the popover hides', () => {
        const src = '[hi](https://x.com)';
        const { emit } = applyUnlink(src, { start: 0, end: src.length }, 'hi');
        expect(emit).toHaveBeenCalledWith('muya-link-tools', { reference: null });
    });

    it('no-ops on null range (defensive)', () => {
        const src = 'untouched';
        const emit = vi.fn();
        const setCursor = vi.fn();
        const fakeThis: IFakeFormatThis = {
            text: src,
            setCursor,
            muya: { eventCenter: { emit } },
        };
        (Format.prototype as unknown as IFormatProtoUnlink).unlink.call(fakeThis, { range: null, text: 'whatever' });
        expect(fakeThis.text).toBe(src);
        expect(setCursor).not.toHaveBeenCalled();
        expect(emit).not.toHaveBeenCalled();
    });
});
