import type { ILinkTail } from './linkDestination';
import type { Labels } from './types';
import { CodeSpanScanner } from './codeSpan';
import { parseSrcAndTitle } from './linkDestination';
import { linkValidateRules } from './rules';
import { matchAt } from './utils';

interface IImageDescription {
    raw: string;
    description: string;
    alt: string;
    backlash: { first: string; second: string };
}

export type ImageMatch = IImageDescription & (
    | { type: 'image'; srcAndTitle: string; tail: ILinkTail }
    | { type: 'reference_image'; label: string; isFullLink: boolean }
);

function splitBackslashes(source: string) {
    const backlash = /\\*$/.exec(source)![0];
    return { text: source.slice(0, source.length - backlash.length), backlash };
}

// Brackets inside code, HTML and nested destinations do not delimit the outer description (§6.4).
function descriptionEnd(source: string, start: number, codeSpans?: CodeSpanScanner): number {
    let depth = 0;
    for (let i = start; i < source.length; i++) {
        const char = source[i];
        if (char === '\\') {
            i++;
        }
        else if (char === '`') {
            codeSpans ??= new CodeSpanScanner(source);
            i = codeSpans.read(i)!.end - 1;
        }
        else if (char === '<') {
            const protectedToken = matchAt(linkValidateRules.html_tag, source, i)
                ?? matchAt(linkValidateRules.auto_link, source, i);
            if (protectedToken)
                i += protectedToken[0].length - 1;
        }
        else if (char === '[') {
            depth++;
        }
        else if (char === ']') {
            if (depth === 0)
                return i;
            depth--;
            if (source[i + 1] === '(') {
                const tail = parseSrcAndTitle(source.slice(i + 2));
                if (tail && source[i + 2 + tail.length] === ')')
                    i += tail.length + 2;
            }
        }
    }
    return -1;
}

export function matchImage(source: string, index: number, labels: Labels, codeSpans?: CodeSpanScanner): ImageMatch | null {
    if (!source.startsWith('![', index))
        return null;

    const end = descriptionEnd(source, index + 2, codeSpans);
    if (end < 0)
        return null;

    const description = source.slice(index + 2, end);
    const { text: alt, backlash: first } = splitBackslashes(description);
    if (source[end + 1] === '(') {
        const rest = source.slice(end + 2);
        const tail = parseSrcAndTitle(rest);
        if (tail && rest[tail.length] === ')') {
            const { text: srcAndTitle, backlash: second } = splitBackslashes(rest.slice(0, tail.length));
            return {
                type: 'image',
                raw: source.slice(index, end + 3 + tail.length),
                description,
                alt,
                srcAndTitle,
                tail,
                backlash: { first, second },
            };
        }
    }

    const reference = /^\[((?:\\.|[^[\]\\])*)\]/.exec(source.slice(end + 1));
    const label = reference?.[1] || description;
    if (!/^(?:\\.|[^[\]\\]){1,999}$/.test(label) || !labels.has(label.toLowerCase()))
        return null;

    return {
        type: 'reference_image',
        raw: source.slice(index, end + 1 + (reference?.[0].length ?? 0)),
        description,
        alt,
        label,
        isFullLink: !!reference?.[1],
        backlash: { first, second: '' },
    };
}
