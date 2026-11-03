// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { tokenizer } from '../lexer';
import { tokenEvents } from '../model/traversal';
import { BracketScanner } from '../parser/brackets';
import { parseInline } from '../parser/lexer';
import { profileForBlock } from '../parser/profiles';
import { SourceWindow } from '../parser/sourceWindow';
import Renderer from '../renderer';
import { ImageMounts } from '../resources/imageMounts';
import { generator, SourceGenerationMode } from '../serialization';

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
        const tokens = parseInline(source, { profile: profileForBlock(block) });
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
    const captureEnvironment = vi.fn(() => environment);
    const renderer = new Renderer(captureEnvironment, new ImageMounts(root));
    const block = { text: '**x**', blockName: 'paragraph.content' };
    const tokens = parseInline(block.text);
    expect(renderer.output(tokens, block, { block, anchor: { offset: 2 }, focus: { offset: 2 } })).toContain('mu-hide');
    expect(captureEnvironment).toHaveBeenCalledTimes(1);
    environment.readOnly = false;
    expect(renderer.output(tokens, block, { block, anchor: { offset: 2 }, focus: { offset: 2 } })).toContain('mu-gray');
    expect(captureEnvironment).toHaveBeenCalledTimes(2);
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
    }), new ImageMounts(root));
    root.innerHTML = renderer.output(parseInline(text), { text, blockName: 'paragraph.content' }, {});
    const preview = root.querySelector<HTMLElement>('.mu-ruby-render')!;
    expect(preview.dataset.start).toBe(String(text.indexOf('>') + 1));
    expect(preview.dataset.end).toBe(String(text.lastIndexOf('</ruby>')));
});

it.each([
    '**a *b ~~c ==d==~~* z**',
    '**[a *b*](/url) <b>c ~~d~~</b>**',
    '**[a *b*][ref]**',
])('renders each nested token once in %s', (text) => {
    const labels = new Map([['ref', { href: '/url', title: '' }]]);
    const tokens = parseInline(text, { labels, options: { highlightSyntax: true } });
    const root = document.createElement('div');
    const renderer = new Renderer(() => ({
        root,
        readOnly: false,
        softNewlineAsSpace: false,
        references: labels,
        selectedImage: null,
        translate: text => text,
    }), new ImageMounts(root));
    const render = vi.spyOn(Renderer.prototype, 'renderToken');
    try {
        const html = renderer.output(tokens, { text, blockName: 'paragraph.content' }, {});
        expect(html).toContain('<strong');
        expect(html).toContain('<em');
        if (text.includes('=='))
            expect(html).toContain('<mark');
        if (text.includes('[a'))
            expect(html).toContain('href="/url"');
        const tokenCount = [...tokenEvents(tokens)].filter(event => !event.exiting).length;
        expect(render).toHaveBeenCalledTimes(tokenCount);
    }
    finally {
        render.mockRestore();
    }
});

it('distinguishes preserved source from edited child wrappers', () => {
    const source = '**<b>before</b>**';
    const tokens = parseInline(source);
    for (const { token, exiting } of tokenEvents(tokens)) {
        if (!exiting && token.type === 'text') {
            token.raw = 'after';
            token.content = 'after';
        }
    }
    expect(generator(tokens)).toBe(source);
    expect(generator(tokens, SourceGenerationMode.PreserveSource)).toBe(source);
    expect(generator(tokens, SourceGenerationMode.RebuildWrappers)).toBe('**<b>after</b>**');
});

it('uses the same feature defaults for bracket protection and token parsing', () => {
    const source = '$[inside](/math)$ [outside](/link)';
    const scanner = new BracketScanner(source, new Map());
    expect(scanner.read(source.indexOf('[inside]'))).toBeNull();
    expect(scanner.read(source.indexOf('[outside]'))?.type).toBe('link');
    const tokens = parseInline(source);
    expect(tokens.map(token => token.type)).toEqual(['inline_math', 'text', 'link']);
});

it.each(['inline', 'setext-heading', 'table-cell'] as const)('keeps reference definitions literal in the %s profile', (profile) => {
    const source = '[ref]: /url';
    expect(parseInline(source, { profile }).some(token => token.type === 'reference_definition')).toBe(false);
    expect(parseInline(source, { profile: 'paragraph' })[0].type).toBe('reference_definition');
});
