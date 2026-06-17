// @vitest-environment happy-dom
import type TreeNode from '../../block/base/treeNode';
import type CodeBlock from '../../block/commonMark/codeBlock';
import type { Nullable } from '../../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../muya';
import { MarkdownToState } from '../markdownToState';
import ExportMarkdown from '../stateToMarkdown';

// Round-trip baseline for non-list block types served by `stateToMarkdown`.
// Each spec runs `markdown → state → markdown` and asserts identity for
// canonical inputs. The intent is regression coverage — these tests should
// not change behaviour, just lock the current contract in place so a
// future refactor of stateToMarkdown can't silently break it.
function roundTrip(md: string): string {
    const states = new MarkdownToState({
        footnote: false,
        math: true,
        isGitlabCompatibilityEnabled: false,
        trimUnnecessaryCodeBlockEmptyLines: false,
        frontMatter: true,
    }).generate(md);
    return new ExportMarkdown({ listIndentation: 1 }).generate(states);
}

function parse(md: string) {
    return new MarkdownToState({
        footnote: false,
        math: true,
        isGitlabCompatibilityEnabled: false,
        trimUnnecessaryCodeBlockEmptyLines: false,
        frontMatter: true,
    }).generate(md);
}

const bootedHosts: HTMLElement[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

// Walk up from the first content leaf to the enclosing `code-block` parent
// (the block that owns the `lang` setter and the `meta.type` field).
function findCodeBlock(muya: Muya): CodeBlock {
    let node: Nullable<TreeNode> = muya.editor.scrollPage!.firstContentInDescendant();
    while (node && node.blockName !== 'code-block')
        node = node.parent;
    return node as CodeBlock;
}

describe('stateToMarkdown — heading round-trip', () => {
    it('round-trips an atx heading at every level', () => {
        const md = `# h1

## h2

### h3

#### h4

##### h5

###### h6
`;
        expect(roundTrip(md)).toBe(md);
    });

    it('round-trips a setext h1 with `===` underline', () => {
        const md = `Hello world
===========
`;
        expect(roundTrip(md)).toBe(md);
    });

    it('round-trips a setext h2 with `---` underline', () => {
        const md = `Hello world
-----------
`;
        expect(roundTrip(md)).toBe(md);
    });

    it('round-trips a thematic break', () => {
        const md = `before

---

after
`;
        expect(roundTrip(md)).toBe(md);
    });
});

describe('stateToMarkdown — code block round-trip', () => {
    it('round-trips a fenced code block with a language tag', () => {
        const md = `\`\`\`js
const x = 1;
const y = 2;
\`\`\`
`;
        expect(roundTrip(md)).toBe(md);
    });

    it('round-trips a fenced code block without a language tag', () => {
        const md = `\`\`\`
plain code
two lines
\`\`\`
`;
        expect(roundTrip(md)).toBe(md);
    });

    it('round-trips a fenced code block containing blank lines', () => {
        const md = `\`\`\`js
line 1

line 3
\`\`\`
`;
        expect(roundTrip(md)).toBe(md);
    });
});

describe('stateToMarkdown — blockquote round-trip', () => {
    it('round-trips a single-line blockquote', () => {
        const md = `> quoted
`;
        expect(roundTrip(md)).toBe(md);
    });

    it('round-trips a multi-line blockquote', () => {
        const md = `> first line
> second line
> third line
`;
        expect(roundTrip(md)).toBe(md);
    });

    it('round-trips a nested blockquote', () => {
        const md = `> outer
>
> > inner quoted
`;
        expect(roundTrip(md)).toBe(md);
    });
});

describe('stateToMarkdown — math block round-trip', () => {
    it('round-trips a `$$`-delimited math block', () => {
        const md = `$$
a^2 + b^2 = c^2
$$
`;
        expect(roundTrip(md)).toBe(md);
    });
});

describe('stateToMarkdown — table round-trip', () => {
    // The column width emitted by stateToMarkdown is `max(5, cell+2)`, so a
    // table with single-character cells canonicalises to width-5 columns.
    it('round-trips a simple 2x2 table with default alignment', () => {
        const md = `| a   | b   |
| --- | --- |
| 1   | 2   |
`;
        expect(roundTrip(md)).toBe(md);
    });

    it('round-trips a table with explicit left/center/right alignment', () => {
        const md = `| a   | b   | c   |
|:--- |:---:| ---:|
| 1   | 2   | 3   |
`;
        expect(roundTrip(md)).toBe(md);
    });
});

describe('stateToMarkdown — table edge cases', () => {
    it('round-trips a cell containing an escaped pipe', () => {
        // Pipes inside cells must be `\|`-escaped both at parse time
        // (markdownToState.restoreTableEscapeCharacters) and at serialize
        // time. Column width is `max(5, longestCell + 2)`, so col 1 (one
        // char `a`) gets width 5 and col 2 (`b \|piped`, 9 chars) gets 11.
        const md = `| a   | b \\|piped |
| --- | --------- |
| 1   | 2         |
`;
        expect(roundTrip(md)).toBe(md);
    });

    it('serialises an empty trailing cell as a blank cell, not nothing', () => {
        const md = `| a   | b   |
| --- | --- |
| 1   |     |
`;
        expect(roundTrip(md)).toBe(md);
    });
});

describe('markdownToState — indented code block', () => {
    it('parses a 4-space-indented block as a code-block with meta.type "indented"', () => {
        const states = parse('    code\n');

        expect(states.length).toBe(1);
        const state = states[0];
        expect(state.name).toBe('code-block');
        // `meta` only exists on the code-block state; narrow before reading it.
        if (state.name !== 'code-block')
            throw new Error('expected a code-block state');
        expect(state.meta.type).toBe('indented');
        // Indented blocks carry no info string, so the language is empty.
        expect(state.meta.lang).toBe('');
        expect(state.text).toBe('code');
    });

    it('round-trips an indented code block back to 4-space-indented markdown', () => {
        // The serializer prefixes every line of a non-fenced code block with
        // exactly four spaces (serializeCodeBlock, `type !== 'fenced'` branch).
        const md = '    code\n';
        expect(roundTrip(md)).toBe(md);
    });

    it('round-trips a multi-line indented code block preserving each line indent', () => {
        const md = '    line one\n    line two\n';
        expect(roundTrip(md)).toBe(md);
    });
});

describe('codeBlock — setting lang promotes an indented block to fenced', () => {
    it('flips meta.type indented -> fenced and updates the live block lang', async () => {
        const muya = bootMuya('    code\n');
        const codeBlock = findCodeBlock(muya);
        expect(codeBlock).toBeTruthy();
        expect(codeBlock.meta.type).toBe('indented');

        codeBlock.lang = 'js';

        // The live block object reflects both the new type and language
        // synchronously (the setter mutates `this.meta` directly).
        expect(codeBlock.meta.type).toBe('fenced');
        expect(codeBlock.meta.lang).toBe('js');

        // The `meta.type` change is dispatched as an OT op, so it reaches the
        // serialized JSON state after the rAF flush.
        await vi.waitFor(() => {
            const state = muya.getState()[0];
            expect(state.name).toBe('code-block');
            if (state.name !== 'code-block')
                throw new Error('expected a code-block state');
            expect(state.meta.type).toBe('fenced');
        });
    });

    it('swaps the DOM class from mu-indented-code to mu-fenced-code', () => {
        const muya = bootMuya('    code\n');
        const codeBlock = findCodeBlock(muya);
        const node = codeBlock.domNode as HTMLElement;
        expect(node.classList.contains('mu-indented-code')).toBe(true);
        expect(node.classList.contains('mu-fenced-code')).toBe(false);

        codeBlock.lang = 'js';

        expect(node.classList.contains('mu-indented-code')).toBe(false);
        expect(node.classList.contains('mu-fenced-code')).toBe(true);
    });

    it('emits a fenced block from getMarkdown (CHARACTERIZATION: drops the language tag — see suspectedBugs)', async () => {
        const muya = bootMuya('    code\n');
        const codeBlock = findCodeBlock(muya);

        codeBlock.lang = 'js';

        // The setter dispatches an OT op ONLY for `meta.type`, never for
        // `meta.lang`. So the serialized JSON state ends up `fenced` but with
        // an EMPTY language: getMarkdown opens a bare ``` fence and the `js`
        // info string is lost. This pins the actual current behaviour.
        await vi.waitFor(() => {
            const md = muya.getMarkdown();
            expect(md).toContain('```');
            expect(md).toContain('code');
        });

        const md = muya.getMarkdown();
        // No longer the indented 4-space form.
        expect(md.startsWith('    ')).toBe(false);
        // Bug: the language tag never reaches the serializer.
        expect(md).not.toContain('```js');
        expect(md).toBe('```\ncode\n```\n');

        // The JSON state confirms the language was dropped while the live
        // block still holds it.
        const state = muya.getState()[0];
        if (state.name !== 'code-block')
            throw new Error('expected a code-block state');
        expect(state.meta.lang).toBe('');
        expect(codeBlock.meta.lang).toBe('js');
    });
});

describe('stateToMarkdown — frontmatter round-trip', () => {
    it('round-trips a YAML frontmatter block', () => {
        // FRONT_REG (utils/marked/frontMatter.ts) requires two newlines
        // after the closing `---`, so canonical YAML frontmatter has a
        // blank line before the document body.
        const md = `---
title: hello
author: world
---

# body
`;
        expect(roundTrip(md)).toBe(md);
    });
});
