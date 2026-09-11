// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { MarkdownToState } from '../markdownToState';
import { renderToStaticHTML } from '../renderToStaticHTML';
import ExportMarkdown from '../stateToMarkdown';

// TeX delimiters `\(...\)` / `\[...\]` are additive with `$` / `$$`.
// Block `\[...\]` is a first-class math-block whose mathStyle is 'latex'
// so serialization writes `\[...\]` back, not `$$`.

interface IBlock {
    name: string;
    text?: string;
    meta?: { mathStyle?: string };
}

function parse(markdown: string, math = true): IBlock[] {
    return new MarkdownToState({
        footnote: false,
        math,
        isGitlabCompatibilityEnabled: false,
        trimUnnecessaryCodeBlockEmptyLines: false,
        frontMatter: false,
    } as never).generate(markdown) as unknown as IBlock[];
}

function serialize(states: IBlock[]): string {
    return new ExportMarkdown({ listIndentation: 1 } as never).generate(
        states as never,
    );
}

const USER_FORMULA = 'd_{\\text{fim a fim}} = N\\frac{L}{R}';
const USER_BLOCK = `\\[
${USER_FORMULA}
\\]
`;

describe('latex math — parse', () => {
    it('parses a multiline \\[ ... \\] block as math-block with mathStyle latex', () => {
        const [block] = parse(USER_BLOCK);
        expect(block.name).toBe('math-block');
        expect(block.meta?.mathStyle).toBe('latex');
        expect(block.text).toBe(USER_FORMULA);
    });

    it('parses a single-line \\[ ... \\] that is the whole paragraph as a math block', () => {
        const [block] = parse('\\[ E = mc^2 \\]\n');
        expect(block.name).toBe('math-block');
        expect(block.meta?.mathStyle).toBe('latex');
        expect(block.text).toBe('E = mc^2');
    });

    it('leaves \\[x\\] with trailing prose as a paragraph', () => {
        const [block] = parse('\\[x\\] is not a block\n');
        expect(block.name).toBe('paragraph');
        expect(block.text).toContain('\\[x\\]');
    });

    it('parses a \\[ block after a preceding paragraph', () => {
        const blocks = parse('Hello\n\n\\[\na\n\\]\n');
        expect(blocks.map(b => b.name)).toEqual(['paragraph', 'math-block']);
        expect(blocks[1]?.meta?.mathStyle).toBe('latex');
        expect(blocks[1]?.text).toBe('a');
    });

    it('does not treat a 4-space-indented \\[ as a math block', () => {
        const [block] = parse('    \\[x\\]\n');
        expect(block.name).not.toBe('math-block');
    });

    it('does not parse \\[ ... \\] as math when math is off', () => {
        const [block] = parse(USER_BLOCK, false);
        expect(block.name).not.toBe('math-block');
    });

    it('does not parse a fenced code block containing \\[ ... \\] as math', () => {
        const md = '```text\n\\[\nx = 1\n\\]\n```\n';
        const [block] = parse(md);
        expect(block.name).toBe('code-block');
        expect(block.text).toContain('\\[');
    });

    it('still parses $$ as a dollar-style math block', () => {
        const [block] = parse('$$\nE = mc^2\n$$\n');
        expect(block.name).toBe('math-block');
        expect(block.meta?.mathStyle).toBe('');
        expect(block.text).toBe('E = mc^2');
    });
});

describe('latex math — serialization', () => {
    it('round-trips a latex-styled math block as \\[ ... \\], not $$', () => {
        const states = parse(USER_BLOCK);
        expect(serialize(states)).toBe(USER_BLOCK);
    });

    it('round-trips $$ unchanged next to a latex block', () => {
        const md = `$$
E = mc^2
$$

\\[
a = b
\\]
`;
        expect(serialize(parse(md))).toBe(md);
    });

    it('round-trips a paragraph that contains inline \\( ... \\)', () => {
        const md = 'The formula \\(E = mc^2\\) is well known.\n';
        expect(serialize(parse(md))).toBe(md);
    });
});

describe('latex math — HTML export', () => {
    it('renders a \\[ ... \\] block via KaTeX', () => {
        const html = renderToStaticHTML(USER_BLOCK, { math: true });
        expect(html).toMatch(/katex|<math/i);
        expect(html).not.toContain('\\[');
    });

    it('renders inline \\( ... \\) via KaTeX', () => {
        const html = renderToStaticHTML(
            'The formula \\(E = mc^2\\) is well known.',
            { math: true },
        );
        expect(html).toMatch(/katex|<math/i);
        expect(html).not.toContain('\\(');
    });

    it('still renders $ and $$ via KaTeX', () => {
        expect(renderToStaticHTML('$E = mc^2$', { math: true }))
            .toMatch(/katex|<math/i);
        expect(renderToStaticHTML('$$\nE = mc^2\n$$', { math: true }))
            .toMatch(/katex|<math/i);
    });

    it('does not render \\[ ... \\] inside a fenced code block as math', () => {
        const html = renderToStaticHTML('```text\n\\[\nx = 1\n\\]\n```\n', { math: true });
        expect(html).not.toMatch(/katex|<math/i);
        expect(html).toContain('\\[');
    });

    it('does not render inline-code \\[x\\] as math', () => {
        const html = renderToStaticHTML('`\\[x\\]`', { math: true });
        expect(html).not.toMatch(/katex|<math/i);
    });
});
