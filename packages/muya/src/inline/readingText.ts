import type { VNode } from 'snabbdom';
import type { ITokenRange } from './model/types';
import { vnode } from 'snabbdom/build/vnode.js';
import { CLASS_NAMES } from '../config';

export interface IReadingSpan extends ITokenRange {
    text: string;
    htmlStart?: number;
    object?: boolean;
}

/** Each block owns its snapshot. An image mount can turn a visible placeholder into a search boundary. */
export class ReadingText {
    readonly spans: IReadingSpan[] = [];
    private _leaves = new WeakMap<VNode, IReadingSpan[]>();

    constructor(readonly onChange: () => void) {}

    mark(node: VNode, span: IReadingSpan | IReadingSpan[]): VNode {
        this._leaves.set(node, Array.isArray(span) ? span : [span]);
        return node;
    }

    collect(root: VNode): void {
        const stack: { node: VNode; htmlStart?: number }[] = [{ node: root }];
        while (stack.length) {
            const { node, htmlStart } = stack.pop()!;
            const classes = node.sel?.split('.');
            const parent = classes?.includes(CLASS_NAMES.MU_RAW_HTML) ? Number(node.data?.dataset?.start) : htmlStart;
            const leaves = this._leaves.get(node);
            if (leaves) {
                for (const leaf of leaves) {
                    if (leaf.text || leaf.object) {
                        leaf.htmlStart = parent;
                        this.spans.push(leaf);
                    }
                }
                continue;
            }
            if (classes?.includes(CLASS_NAMES.MU_HIDE))
                continue;
            const children = node.children ?? [];
            for (let i = children.length - 1; i >= 0; i--) {
                const child = children[i];
                if (typeof child !== 'string')
                    stack.push({ node: child, htmlStart: parent });
            }
        }
    }
}

interface IRenderSession { reading?: ReadingText }

export function renderedText(session: IRenderSession, text: string, start: number, end: number, node: VNode): VNode;
export function renderedText(session: IRenderSession, text: string, start: number): VNode | string;
export function renderedText({ reading }: IRenderSession, text: string, start: number, end = start + text.length, node?: VNode) {
    if (!reading)
        return node ?? text;
    return reading.mark(node ?? vnode(undefined, undefined, undefined, text, undefined), { text, start, end });
}

export function selectedReadingText(spans: IReadingSpan[], start: number, end: number): string {
    const selected = spans.filter(span => span.start < end && span.end > start);
    if (selected.some(span => span.object))
        return '';
    return selected.map(span =>
        span.text.length === span.end - span.start
            ? span.text.slice(Math.max(0, start - span.start), end - span.start)
            : span.text,
    ).join('');
}

// Only authored HTML depends on runtime CSS. A tab being restored can temporarily hide the editor itself.
export function visibleReadingSpans(spans: IReadingSpan[], root: HTMLElement | null): IReadingSpan[] {
    if (!root || !spans.some(span => span.htmlStart !== undefined))
        return spans;
    const suppressed = new Set<HTMLElement>();
    const hidden = new Set<number>();
    const selector = '.mu-raw-html[data-start]';
    const rootVisibility = getComputedStyle(root).visibility;
    for (const element of root.querySelectorAll<HTMLElement>(selector)) {
        const style = getComputedStyle(element);
        const parent = element.parentElement?.closest<HTMLElement>(selector);
        if ((parent && suppressed.has(parent)) || element.hidden || style.display === 'none' || style.opacity === '0' || style.contentVisibility === 'hidden')
            suppressed.add(element);
        if (suppressed.has(element) || (style.visibility !== 'visible' && (style.visibility !== rootVisibility || element.style.visibility)))
            hidden.add(Number(element.dataset.start));
    }
    return spans.filter(span => span.htmlStart === undefined || !hidden.has(span.htmlStart));
}
