import type { VNode } from 'snabbdom';
import type { ITokenRange } from './model/types';
import { vnode } from 'snabbdom/build/vnode.js';
import { CLASS_NAMES } from '../config';

export interface IReadingSpan extends ITokenRange {
    text: string;
    htmlStart?: number;
}

/** Only source-backed leaves participate. Generated previews and editor controls carry no ranges. */
export class ReadingText {
    readonly spans: IReadingSpan[] = [];
    private _leaves = new WeakMap<VNode, IReadingSpan>();

    mark(node: VNode, text: string, start: number, end: number): VNode {
        this._leaves.set(node, { text, start, end });
        return node;
    }

    collect(root: VNode): void {
        const stack: { node: VNode; htmlStart?: number }[] = [{ node: root }];
        while (stack.length) {
            const { node, htmlStart } = stack.pop()!;
            const leaf = this._leaves.get(node);
            if (leaf) {
                if (leaf.text)
                    this.spans.push({ ...leaf, htmlStart });
                continue;
            }
            const classes = node.sel?.split('.');
            if (classes?.includes(CLASS_NAMES.MU_HIDE))
                continue;
            const parent = classes?.includes(CLASS_NAMES.MU_RAW_HTML) ? Number(node.data?.dataset?.start) : htmlStart;
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
    return reading.mark(node ?? vnode(undefined, undefined, undefined, text, undefined), text, start, end);
}

export function selectedReadingText(spans: IReadingSpan[], start: number, end: number): string {
    return spans.filter(span => span.start < end && span.end > start).map(span =>
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
