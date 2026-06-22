import type Content from '../block/base/content';
import type Parent from '../block/base/parent';
import type { TState } from '../state/types';
import type { Nullable } from '../types';

interface IPasteCursor {
    startOffset: number;
    endOffset: number;
}

/**
 * When pasting multi-paragraph
 * markdown into an atx/setext heading, splice the first paragraph state into
 * the heading's text — keeping the heading semantics intact — and return the
 * tail states so the caller can drop them in as new blocks below.
 *
 * When the wrapper is not a heading or the first state isn't a plain paragraph,
 * the original states array is returned untouched and the caller falls back
 * to its previous behaviour (which still needs to collapse any selection).
 */
export function mergePasteIntoHeading(
    anchorBlock: Content,
    wrapperBlock: Nullable<Pick<Parent, 'blockName'>>,
    states: TState[],
    cursor: IPasteCursor,
): TState[] {
    if (states.length === 0)
        return states;

    const isAtx = wrapperBlock?.blockName === 'atx-heading';
    const isSetext = wrapperBlock?.blockName === 'setext-heading';
    if (!isAtx && !isSetext)
        return states;

    const first = states[0];
    if (first.name !== 'paragraph')
        return states;

    const original = anchorBlock.text;
    const head = original.substring(0, cursor.startOffset);
    const remaining = states.slice(1);

    // The anchor's tail is NOT kept here — the caller sews it onto the last
    // pasted block instead.
    if (isSetext) {
        // A setext heading line can hold soft breaks, so the whole first
        // paragraph stays in it (muyajs only splits atx).
        anchorBlock.text = head + first.text;
    }
    else {
        // An atx heading is a single line: only the first soft-line stays; the
        // following lines become a paragraph block below it.
        const [firstLine, ...restLines] = first.text.split('\n');
        anchorBlock.text = head + firstLine;
        if (restLines.length > 0)
            remaining.unshift({ name: 'paragraph', text: restLines.join('\n') });
    }
    anchorBlock.update();

    return remaining;
}
