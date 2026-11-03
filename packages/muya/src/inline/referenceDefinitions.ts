import type { IParagraphState, TState } from '../state/types';
import type { Labels, ReferenceDefinitionToken } from './model/types';
import { decodeMarkdownString } from '../utils/markdownEscape';
import { beginRules } from './parser/rules';
import { normalizeReferenceLabel } from './referenceLabel';

export function parseReferenceDefinition(text: string): Omit<ReferenceDefinitionToken, 'type' | 'parent' | 'range'> | null {
    const match = beginRules.reference_definition.exec(text);
    if (!match)
        return null;
    return {
        raw: match[0],
        leftBracket: match[1],
        label: match[2],
        backlash: match[3] || '',
        rightBracket: match[4],
        leftHrefMarker: match[5] || '',
        href: match[6],
        rightHrefMarker: match[7] || '',
        leftTitleSpace: match[8],
        titleMarker: match[9] || '',
        title: match[10] || '',
        rightTitleSpace: match[11] || '',
    };
}

export function getReferenceDefinition(blockOrState: Pick<IParagraphState, 'text'>) {
    const definition = parseReferenceDefinition(blockOrState.text);
    if (!definition)
        return { label: null, info: null };
    return {
        label: normalizeReferenceLabel(definition.label + definition.backlash),
        info: {
            href: decodeMarkdownString(definition.href),
            title: decodeMarkdownString(definition.title),
        },
    };
}

export class ReferenceDefinitionIndex {
    private _labelsState: readonly TState[] | null = null;
    private _labels: Labels = new Map();

    // Definitions live in paragraphs across the document; rescanning for every block caused #4887.
    collect(state: readonly TState[], read = getReferenceDefinition): Labels {
        if (this._labelsState === state)
            return this._labels;

        const labels = new Map();
        const stack: Iterator<TState>[] = [state[Symbol.iterator]()];
        while (stack.length) {
            const next = stack[stack.length - 1].next();
            if (next.done) {
                stack.pop();
                continue;
            }
            const state = next.value;
            if (state.name === 'paragraph') {
                const { label, info } = read(state);
                if (label && info && !labels.has(label))
                    labels.set(label, info);
            }
            else if ('children' in state && Array.isArray(state.children)) {
                stack.push(state.children[Symbol.iterator]());
            }
        }

        this._labels = labels;
        this._labelsState = state;
        return labels;
    }
}
