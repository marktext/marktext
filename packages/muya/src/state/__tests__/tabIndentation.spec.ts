import type { TState } from '../types';
import { describe, expect, it } from 'vitest';
import { MarkdownToState } from '../markdownToState';
import ExportMarkdown from '../stateToMarkdown';

function codeTexts(states: TState[]): string[] {
    return states.flatMap(state => state.name === 'code-block'
        ? [state.text]
        : 'children' in state ? codeTexts(state.children) : []);
}

describe('tab list serialization', () => {
    // CommonMark §2.2 and §4.5 consume structural columns, retaining code tabs.
    it.each([
        ['- a\n\t```python\n\t\tpass\n\t```\n', '\tpass'],
        ['- a\n\t```python\n\tpass\n\t```\n', 'pass'],
        ['- a\n  ```python\n  \tpass\n  ```\n', '\tpass'],
        ['- a\n\n\t\tpass\n', '  pass'],
        ['10. a\n\n\t\tpass\n', 'pass'],
        ['100. a\n\n\t\t\tpass\n', '   pass'],
        ['-\t```python\n\t\tpass\n\t```\n', '\tpass'],
        ['- a\n\t~~~python\n\t\tpass\n\t~~~\n', '\tpass'],
        ['- a\n\t```\n\t\tpass\n', '\tpass'],
        ['- a\n\t- b\n\t  ```python\n\t  \tpass\n\t  ```\n', '\tpass'],
        ['> - a\n>\n> \t\tpass\n', 'pass'],
        ['> - a\n>\n> \t\t\tpass\n', '\tpass'],
        ['> - a\n> \t~~~python\n> \t\tpass\n> \t~~~\n', '\tpass'],
    ])('keeps the code payload in %j', (markdown, expected) => {
        const parser = new MarkdownToState();
        const state = parser.generate(markdown);
        expect(codeTexts(state)).toEqual([expected]);
        const saved = new ExportMarkdown({ listIndentation: 'tab' }).generate(state);
        expect(codeTexts(parser.generate(saved))).toEqual([expected]);
    });

    it.each([
        '- a\n  - b\n    - c\n',
        '100. a\n     - b\n',
        '> - a\n>   - b\n',
        '> 1. a\n>    - child\n',
        '> > 1. a\n> >    - child\n',
        '> 1. [x] a\n>    - [ ] child\n',
        '- - child\n',
        '- a\n\n  ```python\n  \tpass\n  ```\n',
    ])('retains structure and code content when generating tabs for %j', (markdown) => {
        const parser = new MarkdownToState();
        const state = parser.generate(markdown);
        const printer = new ExportMarkdown({ listIndentation: 'tab' });
        const saved = printer.generate(state);
        expect(parser.generate(saved)).toEqual(state);
        expect(printer.generate(parser.generate(saved))).toBe(saved);
    });
});
