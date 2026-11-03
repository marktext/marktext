// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { generator, parseInline, tokenizer } from '../lexer';
import { tokenEvents } from '../model/traversal';
import { profileForBlock } from '../parser/profiles';
import { SourceWindow } from '../parser/sourceWindow';
import Renderer from '../renderer';

function emojiTokens(source: string) {
    return [...tokenEvents(parseInline(source, { profile: 'inline' }))]
        .filter(({ token, exiting }) => !exiting && token.type === 'emoji')
        .map(({ token }) => token);
}

describe('inline parse contracts', () => {
    it.each(['**foo:smile:**', '[foo:smile:](/url)', '<b>foo:smile:</b>'])('respects emoji boundaries inside %s', (source) => {
        expect(emojiTokens(source)).toHaveLength(0);
    });

    it.each(['**😀 :smile:**', '[😀 :smile:](/url)', '<b>😀 :smile:</b>'])('keeps block-relative UTF-16 offsets inside %s', (source) => {
        const [emoji] = emojiTokens(source);
        expect(emoji.range).toEqual({ start: source.indexOf(':smile:'), end: source.indexOf(':smile:') + 7 });
        expect(generator(parseInline(source))).toBe(source);
    });

    it.each([
        ['paragraph.content', true],
        ['atxheading.content', true],
        ['thematicbreak.content', true],
        ['setextheading.content', false],
        ['table.cell.content', false],
        ['unknown', false],
    ] as const)('applies the explicit block profile for %s', (block, prefix) => {
        const source = '# heading';
        const tokens = parseInline(source, { profile: profileForBlock(block), hasBeginRules: !prefix });
        expect(tokens[0].type).toBe(prefix ? 'header' : 'text');
        expect(generator(tokens)).toBe(source);
    });

    it('keeps search decoration out of the parser and preserves the compatibility pipeline', () => {
        const source = '**hi**';
        const tokens = parseInline(source);
        expect(tokens[0].highlights).toBeUndefined();
        expect(tokenizer(source, { highlights: [{ start: 2, end: 4, active: true }] })[0].highlights).toHaveLength(1);
    });

    it('converts nested source coordinates without counting Unicode code points', () => {
        const source = new SourceWindow('😀x', 12);
        expect(source.local(14)).toBe(2);
        expect(source.absolute(2)).toBe(14);
        expect(source.end).toBe(15);
    });
});

it('renders from structural data without an editor instance and snapshots each output', () => {
    const root = document.createElement('div');
    const environment = {
        root,
        readOnly: true,
        softNewlineAsSpace: false,
        references: new Map(),
        selectedImage: null,
        translate: (text: string) => text,
    };
    const renderer = new Renderer(() => environment);
    const block = { text: '**x**', blockName: 'paragraph.content' };
    const tokens = parseInline(block.text);
    expect(renderer.output(tokens, block, { block, anchor: { offset: 2 }, focus: { offset: 2 } })).toContain('mu-hide');
    environment.readOnly = false;
    expect(renderer.output(tokens, block, { block, anchor: { offset: 2 }, focus: { offset: 2 } })).toContain('mu-gray');
});

it('resolves partial feature options once without disabling unrelated defaults', () => {
    const tokens = parseInline('^x^ $y$ ==z==', { options: { highlightSyntax: true } });
    expect(tokens.map(token => token.type)).toEqual(['super_sub_script', 'text', 'inline_math', 'text', 'mark']);
    expect(parseInline('$x$', { options: { texMathDollars: false } })[0].type).toBe('text');
});

it('derives ruby preview offsets from actual source tags including attributes', () => {
    const text = '<ruby class="annotation">字<rt>zi</rt></ruby>';
    const root = document.createElement('div');
    const renderer = new Renderer(() => ({
        root,
        readOnly: false,
        softNewlineAsSpace: false,
        references: new Map(),
        selectedImage: null,
        translate: text => text,
    }));
    root.innerHTML = renderer.output(parseInline(text), { text, blockName: 'paragraph.content' }, {});
    const preview = root.querySelector<HTMLElement>('.mu-ruby-render')!;
    expect(preview.dataset.start).toBe(String(text.indexOf('>') + 1));
    expect(preview.dataset.end).toBe(String(text.lastIndexOf('</ruby>')));
});

it('renders each nested emphasis token once instead of recursively rebuilding completed children', () => {
    const text = '**a *b ~~c ==d==~~* z**';
    const tokens = parseInline(text, { options: { highlightSyntax: true } });
    const root = document.createElement('div');
    const renderer = new Renderer(() => ({
        root, readOnly: false, softNewlineAsSpace: false, references: new Map(),
        selectedImage: null, translate: text => text,
    }));
    const render = vi.spyOn(Renderer.prototype, 'renderToken');
    try {
        const html = renderer.output(tokens, { text, blockName: 'paragraph.content' }, {});
        expect(html).toContain('<mark');
        const tokenCount = [...tokenEvents(tokens)].filter(event => !event.exiting).length;
        expect(render).toHaveBeenCalledTimes(tokenCount);
    }
    finally {
        render.mockRestore();
    }
});
