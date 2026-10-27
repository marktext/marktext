import type { IResolvedTextSelection } from '../selection/types';
import type { TState } from '../state/types';
import type Content from './base/content';
import { createTextSelectionState } from '../selection/state';
import { MarkdownToState } from '../state/markdownToState';
import { removeIndent } from '../utils/indentation';
import { lexBlock } from '../utils/marked';
import { ScrollPage } from './scrollPage';

interface IParagraphSpan {
    // UTF-16 offsets in the joined paragraph source; end is exclusive.
    start: number;
    end: number;
    states: TState[];
}

// Call after editing contiguous sibling paragraphs, with post-edit selection
// offsets. Code consumes structural indentation, so its endpoints must follow.
export function convertIndentedParagraphs(contents: Content[], selection: IResolvedTextSelection): void {
    if (!contents.some(content => /^(?: {4}| {0,3}\t)/m.test(content.text)))
        return;
    const container = contents[0].parent!.parent!;
    if (contents.some(content => content.parent?.parent !== container))
        return;
    let length = 0;
    const paragraphs = contents.map((content) => {
        const start = length;
        length += content.text.length + 2;
        return { content, start, end: start + content.text.length };
    });
    const source = `${contents.map(content => content.text).join('\n\n')}\n`;
    const spans: IParagraphSpan[] = [];
    let paragraphIndex = 0;
    const appendParagraphs = (from: number, to: number) => {
        while (paragraphIndex < paragraphs.length) {
            const paragraph = paragraphs[paragraphIndex];
            if (paragraph.start >= to)
                break;
            let start = Math.max(from, paragraph.start);
            let end = Math.min(to, paragraph.end);
            while (start < end && source[start] === '\n')
                start++;
            while (end > start && source[end - 1] === '\n')
                end--;
            if (end > start || (paragraph.start === paragraph.end && paragraph.start >= from)) {
                const text = source.slice(start, end);
                // A code prefix can expose previously non-interrupting syntax,
                // e.g. `2. item` at the start of the unselected paragraph tail.
                const states: TState[] = start > paragraph.start
                    ? new MarkdownToState({ ...contents[0].muya.options, frontMatter: false }).generate(text)
                    : [{ name: 'paragraph', text }];
                spans.push({ start, end, states });
            }
            if (paragraph.end >= to)
                break;
            paragraphIndex++;
        }
    };
    let offset = 0;
    let end = 0;
    // The lexer decides paragraph interruption and blank-line boundaries (§4.4).
    for (const token of lexBlock(source, { ...contents[0].muya.options, frontMatter: false })) {
        const start = source.indexOf(token.raw, offset);
        if (start < 0)
            continue;
        offset = start + token.raw.length;
        if (token.type !== 'code' || token.codeBlockStyle !== 'indented')
            continue;
        appendParagraphs(end, start);
        spans.push({
            start,
            end: offset,
            states: [{ name: 'code-block', meta: { type: 'indented', lang: '' }, text: token.text.replace(/\n$/, '') }],
        });
        end = offset;
    }
    if (!end)
        return;
    appendParagraphs(end, source.length);
    const muya = contents[0].muya;
    const replacements = spans.map(span => span.states.map(state => ScrollPage.loadBlock(state.name).create(muya, state)));
    const mapEndpoint = (point: IResolvedTextSelection['anchor']) => {
        const paragraph = paragraphs.find(paragraph => paragraph.content === point.block)!;
        const position = paragraph.start + point.offset;
        let index = spans.findIndex(span => position < span.end || (span.states[0].name === 'paragraph' && position === span.end));
        if (index < 0)
            index = spans.length - 1;
        const span = spans[index];
        const state = span.states[0];
        const block = state.name === 'code-block'
            ? replacements[index][0].lastContentInDescendant()!
            : replacements[index][0].firstContentInDescendant()!;
        const prefix = source.slice(span.start, Math.max(span.start, position));
        // New block syntax can only occur in the excluded tail, whose endpoint
        // is at its beginning rather than inside its Markdown markers.
        const offset = state.name === 'code-block'
            ? prefix.split('\n').map(line => removeIndent(line, 4)).join('\n').length
            : state.name === 'paragraph' ? prefix.length : 0;
        return { block, offset: Math.min(offset, block.text.length) };
    };
    for (const replacement of replacements.flat())
        container.insertBefore(replacement, contents[0].parent!);
    const anchor = mapEndpoint(selection.anchor);
    const focus = mapEndpoint(selection.focus);
    for (const content of contents)
        content.parent!.remove();
    muya.editor.selection.setSelection(createTextSelectionState(
        { ...anchor, path: anchor.block.path },
        { ...focus, path: focus.block.path },
    ));
}
