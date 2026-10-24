// @vitest-environment happy-dom
import type Parent from '../../block/base/parent';
import type CodeBlock from '../../block/commonMark/codeBlock';
import * as json1 from 'ot-json1';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../muya';
import { ChangeSource } from '../../types';
import { asDoc, asState } from '../index';
import { MarkdownToState } from '../markdownToState';
import ExportMarkdown from '../stateToMarkdown';
import { syntaxOperations } from '../syntaxOperations';

vi.mock('../../utils/prism/index', () => ({
    default: {},
    walkTokens: () => null,
    loadedLanguages: new Set(),
    transformAliasToOrigin: (languages: string[]) => languages,
    loadLanguage: () => Promise.resolve([]),
    search: () => [],
}));

const parser = new MarkdownToState({ preserveSyntax: true, frontMatter: false });
const printer = new ExportMarkdown({ listIndentation: 1, syntaxMode: 'preserve' });
const editors: Muya[] = [];

afterEach(() => {
    editors.splice(0).forEach(editor => editor.destroy());
});

function boot(markdown: string) {
    window.MUYA_VERSION = 'test';
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown, preserveSyntax: true, frontMatter: false });
    muya.init();
    editors.push(muya);
    return muya;
}

function assertTree(muya: Muya) {
    const blocks: unknown[] = [];
    muya.editor.scrollPage!.forEach(block => blocks.push((block as Parent).getState()));
    expect(blocks).toEqual(muya.getState());
}

describe('basic block source forms', () => {
    it.each([
        '#\n',
        '##  \n',
        '##   标题  ###  \n',
        '  ###\t标题\t##\t\n',
        '##\t#\t\n',
        '# body#\n',
        '# body \\#\n',
        '  title  \n  ===== \t\n',
        'first  \nsecond\n---\n',
        '~~~~  js title="demo"  \nconst a = 1\n~~~~~~  \n',
        '```\n```\n',
        '```\n\n```\n',
        '```\n\n\n```\n',
        '```\nline  \n\tcode\n\n```\n',
        '  ~~~~ js \n  a\n b\n\tcode\n  ~~~~~  \n',
        '```\nunclosed\n',
        '```\n',
        '\ta\n  \tb\n',
        '    a\n\n    b  \n',
        '  * * *  \n',
        '  <div>\n  content  \n  </div>  \n',
        '[ref]: <https://example.com> "title"\n',
    ])('preserves the covered block body: %j', (source) => {
        const state = parser.generate(source);
        expect(printer.generate(state)).toBe(source);
    });

    it('separates heading semantics from its source form', () => {
        expect(parser.generate('##   title  ###  \n')).toEqual([{
            name: 'atx-heading',
            meta: { level: 2 },
            text: '## title',
            syntax: { indent: '', afterOpening: '   ', closing: { before: '  ', length: 3, after: '  ' } },
        }]);
    });

    it('stores code content after removing only syntactic indentation', () => {
        const state = parser.generate('  ``` js  \n  a  \n\tcode\n  ````\t\n')[0];
        expect(state.name).toBe('code-block');
        if (state.name !== 'code-block')
            throw new Error('Expected code');
        expect(state.meta).toEqual({ lang: 'js' });
        expect(state.text).toBe('a  \n  code');
        expect(state.syntax).toEqual({
            form: 'fenced',
            fenceChar: '`',
            opening: { indent: '  ', length: 3, beforeInfo: ' ', afterInfo: '  ' },
            closing: { indent: '  ', length: 4, after: '\t' },
            prefixes: [{ raw: '  ', remainder: 0 }, { raw: '\t', remainder: 2 }],
        });
    });

    it('preserves code blank lines even when the legacy trimming preference is enabled', () => {
        const source = '```\n\ncode\n\n```\n';
        const state = new MarkdownToState({ preserveSyntax: true, trimUnnecessaryCodeBlockEmptyLines: true }).generate(source);
        expect(printer.generate(state)).toBe(source);
    });
});

describe('source form through Blocks and transactions', () => {
    it.each([
        ['##   title  ###  \n', '## changed', '##   changed  ###  \n'],
        ['  title\n ===== \n', 'changed', '  changed\n ===== \n'],
        ['~~~~ js  \ncode\n~~~~~~ \n', 'changed', '~~~~ js  \nchanged\n~~~~~~ \n'],
    ])('edits content and preserves its form: %j', (source, text, expected) => {
        const muya = boot(source);
        const content = muya.editor.scrollPage!.lastContentInDescendant()!;
        muya.transact(() => {
            content.text = text;
            content.update();
        });
        expect(muya.getMarkdown()).toBe(expected);
        assertTree(muya);
        muya.undo();
        expect(muya.getMarkdown()).toBe(source);
        assertTree(muya);
        muya.redo();
        expect(muya.getMarkdown()).toBe(expected);
        assertTree(muya);
    });

    it('retains source forms through clone and replacement without aliasing', () => {
        const source = '##   title  ###  \n';
        const muya = boot(source);
        const block = muya.editor.scrollPage!.firstChild as Parent;
        const clone = block.clone();
        block.replaceWith(clone);
        muya.flush();
        const state = clone.getState();
        if (state.name !== 'atx-heading')
            throw new Error('Expected heading');
        state.syntax.indent = '  ';
        expect(muya.getMarkdown()).toBe(source);
        expect(clone.getState()).not.toEqual(state);
        assertTree(muya);
    });

    it('adds the required separator when an empty heading gains content', () => {
        const muya = boot('##\n');
        muya.transact(() => {
            muya.editor.scrollPage!.firstContentInDescendant()!.text = '## title';
        });
        expect(muya.getMarkdown()).toBe('## title\n');
        assertTree(muya);
        muya.undo();
        expect(muya.getMarkdown()).toBe('##\n');
        assertTree(muya);
    });

    it('records fence growth with the code edit and undoes both together', () => {
        const muya = boot('~~~ js\ncode\n~~~~~ \n');
        muya.transact(() => {
            muya.editor.scrollPage!.lastContentInDescendant()!.text = 'code\n~~~~';
        });
        expect(muya.getMarkdown()).toBe('~~~~~ js\ncode\n~~~~\n~~~~~ \n');
        assertTree(muya);
        muya.undo();
        expect(muya.getMarkdown()).toBe('~~~ js\ncode\n~~~~~ \n');
        assertTree(muya);
    });

    it('promotes indented code and records the language and form in one transaction', () => {
        const muya = boot('\tcode\n');
        const block = muya.editor.scrollPage!.firstChild as CodeBlock;
        muya.transact(() => {
            block.lang = 'js';
        });
        expect(muya.getMarkdown()).toBe('```js\ncode\n```\n');
        assertTree(muya);
        muya.undo();
        expect(muya.getMarkdown()).toBe('\tcode\n');
        assertTree(muya);
    });

    it('keeps source spacing and closing hashes when changing heading level', () => {
        const muya = boot('  ##   title  #### \n');
        muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(4, 4, true);
        muya.updateParagraph('upgrade heading');
        expect(muya.getMarkdown()).toBe('  #   title  #### \n');
        assertTree(muya);
        muya.undo();
        expect(muya.getMarkdown()).toBe('  ##   title  #### \n');
    });

    it('keeps unaffected line prefixes when inserting a code line', () => {
        const muya = boot('    a\n\tb\n    c\n');
        muya.transact(() => {
            muya.editor.scrollPage!.lastContentInDescendant()!.text = 'a\ninsert\nb\nc';
        });
        expect(muya.getMarkdown()).toBe('    a\n    insert\n\tb\n    c\n');
        assertTree(muya);
    });

    it('does not discard edited code when a partially expanded tab no longer fits', () => {
        const muya = boot('  ```\n\tcode\n  ```\n');
        muya.transact(() => {
            muya.editor.scrollPage!.lastContentInDescendant()!.text = 'changed';
        });
        expect(muya.getMarkdown()).toBe('  ```\n  changed\n  ```\n');
        assertTree(muya);
    });

    it('closes an unclosed fence when inserting a following block', () => {
        const muya = boot('~~~ js\ncode\n');
        muya.editor.scrollPage!.lastContentInDescendant()!.setCursor(4, 4, true);
        muya.insertParagraph('after', 'tail');
        expect(muya.getMarkdown()).toBe('~~~ js\ncode\n~~~\n\ntail\n');
        assertTree(muya);
        muya.undo();
        expect(muya.getMarkdown()).toBe('~~~ js\ncode\n');
        assertTree(muya);
    });

    it('keeps an emptied indented code block representable as code', () => {
        const muya = boot('    code\n');
        muya.transact(() => {
            muya.editor.scrollPage!.lastContentInDescendant()!.text = '';
        });
        expect(muya.getMarkdown()).toBe('```\n```\n');
        assertTree(muya);
        muya.undo();
        expect(muya.getMarkdown()).toBe('    code\n');
        assertTree(muya);
    });

    it('commits a syntax-only API edit, projects it onto the Block and records undo', () => {
        const muya = boot('##   title  ###  \n');
        const changed = vi.fn();
        muya.on('json-change', changed);
        muya.editor.updateContents(json1.replaceOp([0, 'syntax', 'afterOpening'], '   ', '\t'), null, ChangeSource.User);
        expect(changed).toHaveBeenCalledTimes(1);
        expect(muya.getMarkdown()).toBe('##\ttitle  ###  \n');
        assertTree(muya);
        muya.undo();
        expect(muya.getMarkdown()).toBe('##   title  ###  \n');
        assertTree(muya);
    });

    it('transforms independent content and source-form operations on the same state', () => {
        const before = asDoc(parser.generate('##   title  ###  \n'));
        const text = json1.editOp([0, 'text'], 'text-unicode', [8, '!']);
        const form = json1.replaceOp([0, 'syntax', 'afterOpening'], '   ', '\t');
        const left = json1.type.apply(json1.type.apply(before, text), json1.type.transform(form, text, 'right') ?? null);
        const right = json1.type.apply(json1.type.apply(before, form), json1.type.transform(text, form, 'left') ?? null);
        expect(left).toEqual(right);
        expect(printer.generate(asState(left))).toBe('##\ttitle!  ###  \n');
    });

    it('preserves an independent form edit when OT transforms a fence correction', () => {
        const state = parser.generate('~~~ js\ncode\n~~~\n');
        const code = state[0];
        if (code.name !== 'code-block' || code.syntax.form !== 'fenced')
            throw new Error('Expected fenced code');
        const corrected = structuredClone(code.syntax);
        corrected.opening.length = 5;
        corrected.closing!.length = 5;
        const growth = syntaxOperations([0], code.syntax, corrected);
        const padding = json1.replaceOp([0, 'syntax', 'opening', 'afterInfo'], '', '  ');
        const before = asDoc(state);
        const left = json1.type.apply(json1.type.apply(before, growth), json1.type.transform(padding, growth, 'right') ?? null);
        const right = json1.type.apply(json1.type.apply(before, padding), json1.type.transform(growth, padding, 'left') ?? null);
        expect(left).toEqual(right);
        expect(printer.generate(asState(left))).toBe('~~~~~ js  \ncode\n~~~~~\n');
    });
});
