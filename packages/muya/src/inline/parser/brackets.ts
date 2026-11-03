import type { Labels } from '../model/types';
import type { ICodeSpanReader } from './codeSpan';
import type { ILinkTail } from './linkDestination';
import type { InlineRules } from './rules';
import type { IInlineFeatures } from './types';
import { isPunctuationEscape } from '../../utils/markdownEscape';
import { normalizeReferenceLabel } from '../referenceLabel';
import { atomicExtensionLength } from './atomicExtension';
import { CodeSpanScanner } from './codeSpan';
import { resolveInlineFeatures } from './features';
import { parseSrcAndTitle } from './linkDestination';
import { matchAt } from './matchAt';
import { inlineRules, linkValidateRules } from './rules';
import { SourceWindow } from './sourceWindow';

interface IBracketContent {
    raw: string;
    description: string;
    alt: string;
    backlash: { first: string; second: string };
}

type InlineMatch = IBracketContent & { srcAndTitle: string; tail: ILinkTail } & ({ type: 'image' } | { type: 'link' });
type ReferenceMatch = IBracketContent & { label: string; isFullLink: boolean } & ({ type: 'reference_image' } | { type: 'reference_link' });
export type BracketMatch = InlineMatch | ReferenceMatch;
export type ImageMatch = BracketMatch & { type: 'image' | 'reference_image' };
export type LinkMatch = BracketMatch & { type: 'link' | 'reference_link' };

interface IScanContext {
    rules?: InlineRules;
    options?: Partial<IInlineFeatures>;
    // Block-relative UTF-16 origin, including when scanning a child inline source.
    offset?: number;
}

interface IOpener {
    index: number;
    start: number;
    image: boolean;
    active: boolean;
}

function splitBackslashes(source: string) {
    const backlash = /\\*$/.exec(source)![0];
    return { text: source.slice(0, source.length - backlash.length), backlash };
}

function readTail(source: string, opener: IOpener, end: number, labels: Labels): BracketMatch | null {
    if (source[end + 1] !== '(' && labels.size === 0)
        return null;
    const description = source.slice(opener.start, end);
    const { text: alt, backlash: first } = splitBackslashes(description);
    const content = { description, alt, backlash: { first, second: '' } };
    if (source[end + 1] === '(') {
        const rest = source.slice(end + 2);
        const tail = parseSrcAndTitle(rest);
        if (tail && rest[tail.length] === ')') {
            const { text: srcAndTitle, backlash: second } = splitBackslashes(rest.slice(0, tail.length));
            return {
                ...content,
                type: opener.image ? 'image' : 'link',
                raw: source.slice(opener.index, end + 3 + tail.length),
                srcAndTitle,
                tail,
                backlash: { first, second },
            };
        }
    }

    const reference = /^\[((?:\\.|[^[\]\\])*)\]/.exec(source.slice(end + 1));
    const label = reference?.[1] || description;
    if (!/^(?:\\.|[^[\]\\]){1,999}$/.test(label) || !labels.has(normalizeReferenceLabel(label)))
        return null;

    return {
        ...content,
        type: opener.image ? 'reference_image' : 'reference_link',
        raw: source.slice(opener.index, end + 1 + (reference?.[0].length ?? 0)),
        label,
        isFullLink: !!reference?.[1],
    };
}

function readProtected(source: string, index: number, codeSpans: ICodeSpanReader, rules: InlineRules, options: IInlineFeatures, offset: number): { end: number; html?: boolean } {
    const extensionLength = atomicExtensionLength(source, index, rules, options, offset);
    if (extensionLength)
        return { end: index + extensionLength };
    if (isPunctuationEscape(source, index))
        return { end: index + 2 };
    if (source[index] === '`')
        return { end: codeSpans.read(index)!.end };
    if (source[index] === '<') {
        const autoLink = matchAt(linkValidateRules.auto_link, source, index);
        if (autoLink)
            return { end: index + autoLink[0].length };
        const html = matchAt(linkValidateRules.html_tag, source, index);
        if (html)
            return { end: index + html[0].length, html: true };
    }
    return { end: index };
}

// Resolve closers in source order: a successful link deactivates earlier link openers,
// while image openers remain eligible (CommonMark §6.3 and §6.4).
export class BracketScanner {
    private _matches = new Map<number, BracketMatch>();
    private _tails = new Map<number, number>();
    private _readProtected: (index: number) => { end: number; html?: boolean };

    constructor(source: string, labels: Labels, codeSpans: ICodeSpanReader = new CodeSpanScanner(source), { rules = inlineRules, options = {}, offset = 0 }: IScanContext = {}) {
        const features = resolveInlineFeatures(options);
        const window = new SourceWindow(source, offset);
        this._readProtected = (index) => {
            const match = readProtected(source, window.local(index), codeSpans, rules, features, offset);
            return { ...match, end: window.absolute(match.end) };
        };
        const openers: IOpener[] = [];
        for (let i = 0; i < source.length; i++) {
            const { end } = readProtected(source, i, codeSpans, rules, features, offset);
            if (end > i) {
                i = end - 1;
                continue;
            }
            const char = source[i];
            if (char === '[' || (char === '!' && source[i + 1] === '[')) {
                const image = char === '!';
                openers.push({ index: i, start: i + (image ? 2 : 1), image, active: true });
                if (image)
                    i++;
            }
            else if (char === ']') {
                const opener = openers.pop();
                if (!opener?.active)
                    continue;
                const match = readTail(source, opener, i, labels);
                if (match) {
                    this._matches.set(window.absolute(opener.index), match);
                    this._tails.set(window.absolute(i), window.absolute(opener.index + match.raw.length));
                    i = opener.index + match.raw.length - 1;
                    if (!opener.image)
                        this._deactivateLinks(openers);
                }
            }
        }
    }

    // Child tokenization reuses this index, but cannot consume a tail outside its source.
    read(index: number, end = Number.POSITIVE_INFINITY): BracketMatch | null {
        const match = this._matches.get(index);
        return match && index + match.raw.length <= end ? match : null;
    }

    /** HTML pairing must not consume recognized link/image bodies, tails or atomic extensions. */
    protectedEnd(index: number): number {
        const bracket = this._matches.get(index);
        if (bracket)
            return index + bracket.raw.length;
        const tail = this._tails.get(index);
        if (tail !== undefined)
            return tail;
        const match = this._readProtected(index);
        return match.html ? index : match.end;
    }

    private _deactivateLinks(openers: IOpener[]): void {
        for (let i = openers.length - 1; i >= 0; i--) {
            const opener = openers[i];
            if (!opener.active)
                break;
            if (!opener.image)
                opener.active = false;
        }
    }
}
