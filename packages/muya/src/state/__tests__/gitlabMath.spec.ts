import { describe, expect, it } from 'vitest';
import { MarkdownToState } from '../markdownToState';
import ExportMarkdown from '../stateToMarkdown';

// GitLab-flavoured Markdown lets a fenced code block tagged ```math render as
// block math (display mode), serializing back as ```math instead of $$. In the
// new engine the promotion is split across two seams:
//   * parse:     utils/marked/walkTokens.ts rewrites a `code`/lang=math token
//                into a `multiplemath` token with mathStyle='gitlab', but ONLY
//                when BOTH `math` AND `isGitlabCompatibilityEnabled` are true.
//   * serialize: state/stateToMarkdown.ts::_serializeMathBlock picks the fence
//                purely from meta.mathStyle ('' → $$, 'gitlab' → ```math) — it
//                does NOT re-read the option, so a block keeps its origin style.
// The legacy engine (packages/muyajs) detected the same syntax with a dedicated
// regex (`multiplemathGitlab` in parser/marked/blockRules.js). These specs lock
// the state round-trip the renderer test (renderToStaticHTML.spec.ts) does not
// cover, and pin where the two engines agree vs diverge.

interface IMathLike {
    name: string;
    text?: string;
    meta?: { mathStyle?: string; lang?: string; type?: string };
}

function parse(
    markdown: string,
    options: Partial<{ math: boolean; isGitlabCompatibilityEnabled: boolean }> = {},
): IMathLike[] {
    return new MarkdownToState({
        footnote: false,
        math: true,
        isGitlabCompatibilityEnabled: true,
        trimUnnecessaryCodeBlockEmptyLines: false,
        frontMatter: false,
        ...options,
    } as never).generate(markdown) as unknown as IMathLike[];
}

function serialize(states: IMathLike[]): string {
    return new ExportMarkdown({ listIndentation: 1 } as never).generate(
        states as never,
    );
}

describe('gitlab math — parse promotion (walkTokens)', () => {
    it('promotes ```math to a gitlab-styled math block when math + gitlab are on', () => {
        const [block] = parse('```math\nx^2\n```\n');
        expect(block.name).toBe('math-block');
        expect(block.meta?.mathStyle).toBe('gitlab');
        expect(block.text).toBe('x^2');
    });

    it('leaves ```math as a plain code block when gitlab compatibility is off', () => {
        const [block] = parse('```math\nx^2\n```\n', { isGitlabCompatibilityEnabled: false });
        expect(block.name).toBe('code-block');
        expect(block.meta?.lang).toBe('math');
        expect(block.meta?.mathStyle).toBeUndefined();
    });

    it('leaves ```math as a plain code block when math is off (both flags required)', () => {
        const [block] = parse('```math\nx^2\n```\n', { math: false });
        expect(block.name).toBe('code-block');
        expect(block.meta?.lang).toBe('math');
    });

    it('always parses $$ as a non-gitlab math block, independent of the flag', () => {
        for (const gitlab of [true, false]) {
            const [block] = parse('$$\nx^2\n$$\n', { isGitlabCompatibilityEnabled: gitlab });
            expect(block.name).toBe('math-block');
            expect(block.meta?.mathStyle).toBe('');
        }
    });
});

describe('gitlab math — serialization (stateToMarkdown)', () => {
    it('serializes a gitlab-styled math block back to ```math', () => {
        const states = parse('```math\nx^2\n```\n');
        expect(serialize(states)).toBe('```math\nx^2\n```\n');
    });

    it('serializes a $$ math block back to $$', () => {
        const states = parse('$$\nx^2\n$$\n');
        expect(serialize(states)).toBe('$$\nx^2\n$$\n');
    });

    it('keys the fence purely on meta.mathStyle, not on the option (mixed mode)', () => {
        // A block authored in gitlab mode keeps the ```math fence even if the
        // serializer is given a state that originated from $$ — proving the
        // fence choice rides on the stored style, never the runtime flag.
        const states = parse('$$\nx^2\n$$\n');
        states[0].meta!.mathStyle = 'gitlab';
        expect(serialize(states)).toBe('```math\nx^2\n```\n');
    });

    it('preserves indentation when a gitlab math block is nested in a list', () => {
        const md = '- item\n\n  ```math\n  x^2\n  ```\n';
        expect(serialize(parse(md))).toBe(md);
    });
});

describe('gitlab math — round-trip stability', () => {
    it('round-trips ```math unchanged with gitlab compatibility on', () => {
        const md = '```math\nx^2\n```\n';
        expect(serialize(parse(md))).toBe(md);
    });

    it('round-trips $$ unchanged regardless of the flag', () => {
        const md = '$$\nx^2\n$$\n';
        expect(serialize(parse(md, { isGitlabCompatibilityEnabled: false }))).toBe(md);
    });
});

// Characterization of where the new engine (@muyajs/core) agrees with and
// diverges from the legacy engine (packages/muyajs) for the SAME input under
// gitlab compatibility. muyajs gated promotion on the regex
//   /^ {0,3}(`{3,})math\n.../
// — backtick-only, `math` immediately before the newline, ≤3 leading spaces.
// muya instead promotes any marked `code` token whose lang === 'math', so its
// acceptance set is "whatever marked treats as a fenced code block labelled
// math". Most cases coincide; the tilde-fence case is the one real divergence.
describe('gitlab math — consistency with legacy muyajs', () => {
    it('agree — a 3-space indented ```math is still promoted (both engines)', () => {
        const [block] = parse('   ```math\nx^2\n```\n');
        expect(block.name).toBe('math-block');
        expect(block.meta?.mathStyle).toBe('gitlab');
    });

    it('agree — a 4-space indented fence is an indented code block, not math (both engines)', () => {
        const [block] = parse('    ```math\nx^2\n```\n');
        expect(block.name).toBe('code-block');
        expect(block.meta?.type).toBe('indented');
    });

    it('agree — a 4+ backtick ```math fence is promoted (both engines)', () => {
        const [block] = parse('````math\nx^2\n````\n');
        expect(block.name).toBe('math-block');
        expect(block.meta?.mathStyle).toBe('gitlab');
    });

    it('agree — an info string after math (```math foo) is NOT promoted (both engines)', () => {
        const [block] = parse('```math foo\nx^2\n```\n');
        expect(block.name).toBe('code-block');
    });

    it('agree — the math language tag is case-sensitive — ```MATH is NOT promoted (both engines)', () => {
        const [block] = parse('```MATH\nx^2\n```\n');
        expect(block.name).toBe('code-block');
        expect(block.meta?.lang).toBe('MATH');
    });

    it('diverge — a tilde ~~~math fence IS promoted by muya, but muyajs (backtick-only regex) left it a code block', () => {
        const [block] = parse('~~~math\nx^2\n~~~\n');
        // muya keys on marked\'s generic fenced-code parser, which accepts both
        // ``` and ~~~ fences, so the math language tag promotes either way and
        // the block re-serializes with a backtick fence. The legacy regex never
        // matched ~~~, so the same source stayed a plain code block there.
        expect(block.name).toBe('math-block');
        expect(block.meta?.mathStyle).toBe('gitlab');
        expect(serialize(parse('~~~math\nx^2\n~~~\n'))).toBe('```math\nx^2\n```\n');
    });
});
