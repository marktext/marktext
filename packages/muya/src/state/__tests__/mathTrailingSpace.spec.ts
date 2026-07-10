import { describe, expect, it } from 'vitest';
import { MarkdownToState } from '../markdownToState';

// #1931: a display-math block whose closing `$$` has trailing whitespace
// (e.g. `$$ `) was not recognized as math — the block regex required the
// closing marker to be immediately followed by a newline or end-of-input, so
// any trailing space made it fall through to plain text. Fenced code blocks
// already tolerate trailing spaces; math should too.

interface IBlock { name: string; text?: string }

function parse(markdown: string): IBlock[] {
    return new MarkdownToState({
        footnote: false,
        math: true,
        isGitlabCompatibilityEnabled: false,
        trimUnnecessaryCodeBlockEmptyLines: false,
        frontMatter: false,
    } as never).generate(markdown) as unknown as IBlock[];
}

describe('block math — closing $$ with trailing whitespace (#1931)', () => {
    it('parses a math block whose closing $$ has a trailing space', () => {
        const states = parse('$$\nx = 1\n$$ \n\nbar\n');
        expect(states.some(s => s.name === 'math-block')).toBe(true);
    });

    it('parses a math block whose closing $$ has a trailing tab', () => {
        const states = parse('$$\nx = 1\n$$\t\n\nbar\n');
        expect(states.some(s => s.name === 'math-block')).toBe(true);
    });

    it('still parses a math block with no trailing space (regression)', () => {
        const states = parse('$$\nx = 1\n$$\n\nbar\n');
        expect(states.some(s => s.name === 'math-block')).toBe(true);
    });
});
