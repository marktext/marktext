import type { IHtmlBlockBoundary } from '../utils/marked/htmlBlockBoundary';
import type { TState } from './types';
import { getHtmlBlockBoundary } from '../utils/marked/htmlBlockBoundary';

export type TBlockSeparation = 'adjacent' | 'blank-line' | 'rewrite-required';

export interface IBlockBoundaryContext {
    tightListItem: boolean;
}

// These spellings end their block without consuming the next line.
const SELF_TERMINATING_BLOCKS = new Set<TState['name']>([
    'atx-heading',
    'setext-heading',
    'thematic-break',
    'code-block',
    'math-block',
    'diagram',
]);

/**
 * Choose a separator without changing block meaning. A blank line can change
 * list tightness, and cannot separate two indented code blocks at all.
 */
export class BlockBoundaryResolver {
    private _htmlBoundaries = new Map<string, IHtmlBlockBoundary>();

    reset() {
        this._htmlBoundaries.clear();
    }

    resolve(previous: TState, next: TState, context: IBlockBoundaryContext): TBlockSeparation {
        if (previous.name === 'code-block' && previous.meta.type === 'indented'
            && next.name === 'code-block' && next.meta.type === 'indented') {
            return 'rewrite-required';
        }

        if (!context.tightListItem || next.name === 'github-alert')
            return 'blank-line';

        if (SELF_TERMINATING_BLOCKS.has(previous.name))
            return 'adjacent';

        if (previous.name === 'html-block') {
            return this._htmlBoundary(previous.text).endsWithoutBlankLine
                ? 'adjacent'
                : 'blank-line';
        }

        if (previous.name === 'paragraph')
            return this._interruptsParagraph(next) ? 'adjacent' : 'blank-line';

        // A plain paragraph can lazily continue a quote. Only an interrupting
        // block written outside its `>` prefix reliably ends that quote.
        if (previous.name === 'block-quote' && next.name !== 'block-quote') {
            return this._interruptsParagraph(next, false) ? 'adjacent' : 'blank-line';
        }

        return 'blank-line';
    }

    private _interruptsParagraph(next: TState, setextPrecedence = true): boolean {
        switch (next.name) {
            case 'atx-heading':
            case 'block-quote':
            case 'diagram':
                return true;

            case 'code-block':
                return next.meta.type === 'fenced';

            case 'thematic-break':
                // Directly below paragraph text, contiguous dashes are a
                // Setext underline instead of the intended thematic break.
                return !setextPrecedence || !/^ {0,3}-+[ \t]*$/.test(next.text);

            case 'html-block':
                return this._htmlBoundary(next.text).interruptsParagraph;

            default:
                return false;
        }
    }

    private _htmlBoundary(html: string): IHtmlBlockBoundary {
        let boundary = this._htmlBoundaries.get(html);
        if (!boundary) {
            boundary = getHtmlBlockBoundary(html);
            this._htmlBoundaries.set(html, boundary);
        }
        return boundary;
    }
}
