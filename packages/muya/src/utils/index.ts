import type { Diff } from 'fast-diff';
import type Content from '../block/base/content';
import type { Config } from './dompurify';
import { EVENT_KEYS } from '../config';
import runSanitize from './dompurify';

interface IUnion {
    start: number;
    end: number;
    active?: boolean;
}

// A contravariant never[] tuple accepts concrete constructor signatures without any[].
type Constructor = new (...args: never[]) => object;

interface IDefer<T> {
    resolve: (value: T) => void;
    reject: (reason?: unknown) => void;
    promise: Promise<T>;
}

export function* uniqueIdGenerator() {
    let id = 0;

    while (true)
        yield id++;
}

const ID_PREFIX = 'mu-';
const uniqueIdIterator = uniqueIdGenerator();

export const getUniqueId = () => `${ID_PREFIX}${uniqueIdIterator.next().value}`;

export function getLongUniqueId() {
    return `${getUniqueId()}-${(Date.now()).toString(32)}`;
}

export function noop() {}

export const identity = <T>(i: T): T => i;

export const isOdd = (n: number) => Math.abs(n) % 2 === 1;

export const isEven = (n: number) => Math.abs(n) % 2 === 0;

export const isLengthEven = (str = '') => str.length % 2 === 0;

export function snakeToCamel(name: string) {
    return name.replace(/_([a-z])/g, (_p0, p1) => p1.toUpperCase());
}

// Highlight only the first non-whitespace word; preserve the full fence info string elsewhere.
export function firstWordOfInfo(info: string): string {
    return info.trimStart().match(/\S*/)?.[0] ?? '';
}

export interface IFenceLine {
    fenceChar: '`' | '~';
    fenceLength: number;
    info: string;
}

const FENCE_LINE_REG = /^ {0,3}(`{3,}|~{3,})([^\n]*)/;

// Return null for invalid opening fences. Backtick info strings cannot contain backticks; tilde info can.
export function parseFenceLine(text: string): IFenceLine | null {
    const match = FENCE_LINE_REG.exec(text);
    if (!match)
        return null;

    const fence = match[1];
    const info = match[2];
    if (fence[0] === '`' && info.includes('`'))
        return null;

    return { fenceChar: fence[0] as '`' | '~', fenceLength: fence.length, info };
}
export function conflict(arr1: [number, number], arr2: [number, number]) {
    return !(arr1[1] < arr2[0] || arr2[1] < arr1[0]);
}

export function union({ start: tStart, end: tEnd }: IUnion, { start: lStart, end: lEnd, active }: IUnion) {
    if (!(tEnd <= lStart || lEnd <= tStart)) {
        if (lStart < tStart) {
            return {
                start: tStart,
                end: tEnd < lEnd ? tEnd : lEnd,
                active,
            };
        }
        else {
            return {
                start: lStart,
                end: tEnd < lEnd ? tEnd : lEnd,
                active,
            };
        }
    }

    return null;
}

// Adapted from https://github.com/jashkenas/underscore.
export function throttle<TArgs extends unknown[], TReturn>(
    func: (...args: TArgs) => TReturn,
    wait = 50,
): (...args: TArgs) => TReturn | undefined {
    let context: unknown;
    let pendingArgs: TArgs | null = null;
    let result: TReturn | undefined;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let previous = 0;
    const later = () => {
        previous = Date.now();
        timeout = null;
        // `[]` is assignable to every concrete TArgs at runtime — the throttled
        // call site always supplies real args; the empty array only flows in
        // when there's nothing pending. TS rejects the single-cast form for an
        // unconstrained `TArgs extends unknown[]`; double-cast at the boundary.
        // eslint-disable-next-line no-restricted-syntax
        result = func.apply(context, pendingArgs ?? ([] as unknown as TArgs));
        if (!timeout) {
            context = null;
            pendingArgs = null;
        }
    };

    return function (this: unknown, ...callArgs: TArgs): TReturn | undefined {
        const now = Date.now();
        const remaining = wait - (now - previous);

        // eslint-disable-next-line ts/no-this-alias
        context = this;
        pendingArgs = callArgs;
        if (remaining <= 0 || remaining > wait) {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            previous = now;
            result = func.apply(context, pendingArgs);
            if (!timeout) {
                context = null;
                pendingArgs = null;
            }
        }
        else if (!timeout) {
            timeout = setTimeout(later, remaining);
        }

        return result;
    };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null)
        return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

// Clone arrays and plain objects iteratively to support deeply nested Markdown (#4747).
// Preserve shared references; use structuredClone for other object types.
export function deepClone<T>(value: T): T {
    if (!Array.isArray(value) && !isPlainObject(value))
        return structuredClone(value);

    const copies = new Map<object, object>();
    const stack: object[] = [];

    const copyOf = (source: unknown): unknown => {
        if (!Array.isArray(source) && !isPlainObject(source)) {
            return typeof source === 'object' && source !== null
                ? structuredClone(source)
                : source;
        }
        let copy = copies.get(source);
        if (copy === undefined) {
            copy = Array.isArray(source) ? [] : {};
            copies.set(source, copy);
            stack.push(source);
        }
        return copy;
    };

    const root = copyOf(value) as T;
    while (stack.length) {
        const source = stack.pop() as Record<string, unknown>;
        const target = copies.get(source) as Record<string, unknown>;
        for (const key of Object.keys(source))
            target[key] = copyOf(source[key]);
    }

    return root;
}

export function escapeHTML(str: string) {
    return str.replace(
        /[&<>'"]/g,
        tag =>
            ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '\'': '&#39;',
                '"': '&quot;',
            }[tag] || tag),
    );
}

export function unescapeHTML(str: string) {
    return str.replace(
        /&amp;|&lt;|&gt;|&quot;|&#39;/g,
        tag =>
            ({
                '&amp;': '&',
                '&lt;': '<',
                '&gt;': '>',
                '&#39;': '\'',
                '&quot;': '"',
            }[tag] || tag),
    );
}

export function escapeInBlockHtml(html: string) {
    return html.replace(
        /(<(style|script|title)[^<>]*>)([\s\S]*?)(<\/\2>)/g,
        (_m, p1, _p2, p3, p4) => {
            return `${escapeHTML(p1)}${p3}${escapeHTML(p4)}`;
        },
    );
}

export function wordCount(markdown: string) {
    const paragraph = markdown.split(/\n{2,}/).filter(line => line).length;
    let word = 0;
    let character = 0;
    let all = 0;

    const removedChinese = markdown.replace(/[\u4E00-\u9FA5]/g, '');
    const tokens = removedChinese.split(/\s+/).filter(t => t);
    const chineseWordLength = markdown.length - removedChinese.length;
    word += chineseWordLength + tokens.length;
    character += tokens.reduce((acc, t) => acc + t.length, 0) + chineseWordLength;
    all += markdown.length;

    return { word, paragraph, character, all };
}

export function sanitize(html: string, purifyOptions: Config, disableHtml: boolean) {
    if (disableHtml)
        return runSanitize(escapeHTML(html), purifyOptions);
    else
        return runSanitize(escapeInBlockHtml(html), purifyOptions);
}

export function getParagraphReference(ele: HTMLElement, id: string) {
    const { x, y, left, top, bottom, height } = ele.getBoundingClientRect();

    return {
        getBoundingClientRect() {
            return { x, y, left, top, bottom, height, width: 0, right: left };
        },
        clientWidth: 0,
        clientHeight: height,
        id,
    };
}

// ot-text-unicode measures positions in code points, not grapheme clusters.
// Unchanged diff spans must use the same units or subsequent operations corrupt state (#4926).
function codePointLength(str: string) {
    let length = 0;
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code >= 0xD800 && code <= 0xDFFF)
            i++; // Count a surrogate pair as the single code point it encodes.

        length++;
    }

    return length;
}

// Visible characters can span multiple code points; caret movement and deletion
// use grapheme boundaries to match browser behavior (UAX #29).

export interface IGraphemeCluster {
    /** Offset of the cluster's first UTF-16 code unit. */
    start: number;
    /** Offset just past the cluster's last UTF-16 code unit. */
    end: number;
}

let graphemeSegmenter: Intl.Segmenter | null | undefined;

function getGraphemeSegmenter(): Intl.Segmenter | null {
    if (graphemeSegmenter === undefined) {
        graphemeSegmenter
            = typeof Intl.Segmenter === 'function'
                ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
                : null;
    }

    return graphemeSegmenter;
}

// Yield [start, end) UTF-16 ranges. Without Intl.Segmenter, fall back to whole code points.
export function* graphemeClusters(text: string): Generator<IGraphemeCluster> {
    const segmenter = getGraphemeSegmenter();
    if (segmenter) {
        for (const { segment, index } of segmenter.segment(text))
            yield { start: index, end: index + segment.length };

        return;
    }

    for (let i = 0; i < text.length;) {
        const end = i + (text.codePointAt(i)! > 0xFFFF ? 2 : 1);
        yield { start: i, end };
        i = end;
    }
}

// UTF-16 length of the first grapheme cluster.
export function firstGraphemeLength(text: string): number {
    const [first] = graphemeClusters(text);

    return first ? first.end - first.start : 0;
}

// UTF-16 length of the last grapheme cluster.
export function lastGraphemeLength(text: string): number {
    let length = 0;
    for (const cluster of graphemeClusters(text))
        length = cluster.end - cluster.start;

    return length;
}

export type TDiff = (string | number | { d: string });

export function diffToTextOp(diffs: Diff[]) {
    const op: TDiff[] = [];

    for (const diff of diffs) {
        switch (diff[0]) {
            case -1:
                op.push({ d: diff[1] });
                break;

            case 0:
                op.push(codePointLength(diff[1]));
                break;

            case 1:
                op.push(diff[1]);
                break;

            default:
                break;
        }
    }

    let peak = op[op.length - 1];
    while (typeof peak === 'number') {
        op.pop();
        peak = op[op.length - 1];
    }

    return op;
}

export function lineBounds(text: string, offset: number): [number, number] {
    const start = text.lastIndexOf('\n', offset - 1) + 1;
    const end = text.indexOf('\n', start);

    return [start, end === -1 ? text.length : end];
}

// If the next block is header, put cursor after the `#{1,6} *`
export function adjustOffset<T extends Content>(offset: number, block: T, event: KeyboardEvent) {
    if (
        block.parent?.blockName === 'atx-heading'
        && event.key === EVENT_KEYS.ArrowDown
    ) {
        const match = /^\s{0,3}#{1,6}(?:\s+|$)/.exec(block.text);
        if (match)
            return match[0].length;
    }

    return offset;
}

export function verticalPositionInRect(event: MouseEvent, rect: DOMRect) {
    const { clientY } = event;
    const { top, height } = rect;

    return clientY - top > height / 2 ? 'down' : 'up';
}

export function hasPick(c: { p?: number; r?: unknown } | null | undefined): boolean {
    return !!c && (c.p != null || c.r !== undefined);
}

export function getDefer<T>() {
    const defer: IDefer<T> = {} as IDefer<T>;
    const promise = new Promise<T>((resolve, reject) => {
        defer.resolve = resolve;
        defer.reject = reject;
    });
    defer.promise = promise;

    return defer;
}

export function methodMixins(
    // `never[]` in the arg-tuple position (contravariant) accepts any
    // function shape — the inlineSyntaxRenderer mixin map has methods with
    // wildly different signatures (`backlashInToken`, `header`, `link`…).
    ...objects: Record<string, (...args: never[]) => unknown>[]
) {
    return (constructor: Constructor) => {
        for (const object of objects) {
            Object.keys(object).forEach((name) => {
                Object.defineProperty(
                    constructor.prototype,
                    name,
                    Object.getOwnPropertyDescriptor(object, name) || Object.create(null),
                );
            });
        }
    };
}

export function mixins(...constructors: Constructor[]) {
    return (derivedCtor: Constructor) => {
        constructors.forEach((baseCtor) => {
            Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
                if (name === 'constructor')
                    return;

                Object.defineProperty(
                    derivedCtor.prototype,
                    name,
                    Object.getOwnPropertyDescriptor(baseCtor.prototype, name)
                    || Object.create(null),
                );
            });
        });
    };
}

export function isKeyboardEvent(event: Event): event is KeyboardEvent {
    return 'key' in event;
}

export function isMouseEvent(event: Event): event is MouseEvent {
    return 'x' in event;
}

export function isInputEvent(event: Event): event is InputEvent {
    return 'inputType' in event;
}

// IME compositionend carries committed data without the inputType required by isInputEvent.
export function isCompositionEndEvent(event: Event): event is CompositionEvent {
    return event.type === 'compositionend';
}

export function isElement(node: Node): node is Element {
    return node.nodeType === Node.ELEMENT_NODE;
}

export function isClipboardEvent(event: Event): event is ClipboardEvent {
    return 'clipboardData' in event;
}

export function isHTMLElement(value: unknown): value is HTMLElement {
    return value instanceof HTMLElement;
}

export function isHTMLInputElement(value: unknown): value is HTMLInputElement {
    return value instanceof HTMLInputElement;
}

export function isHTMLTextAreaElement(value: unknown): value is HTMLTextAreaElement {
    return value instanceof HTMLTextAreaElement;
}

export function isHTMLAnchorElement(value: unknown): value is HTMLAnchorElement {
    return value instanceof HTMLAnchorElement;
}
