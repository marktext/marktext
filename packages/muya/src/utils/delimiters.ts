export interface IDelimiterSpan {
    start: number;
    end: number;
    markerLength: number;
}

export interface IDelimiterRun {
    char: string;
    // Rule-of-three balancing uses the original length, even after partial consumption.
    length: number;
    // The remaining delimiters occupy [left, right) in UTF-16 source offsets.
    left: number;
    right: number;
    canOpen: boolean;
    canClose: boolean;
}

/** Reads a full code point before a UTF-16 offset; empty at the start. */
export function codePointBefore(s: string, i: number): string {
    if (i <= 0)
        return '';
    const lastUnit = s.charCodeAt(i - 1);
    if (lastUnit >= 0xDC00 && lastUnit <= 0xDFFF && i >= 2) {
        const prevUnit = s.charCodeAt(i - 2);
        if (prevUnit >= 0xD800 && prevUnit <= 0xDBFF)
            return s.slice(i - 2, i);
    }
    return s.charAt(i - 1);
}

/** Reads a full code point at a UTF-16 offset; undefined past the end. */
export function codePointCharAt(s: string, i: number): string | undefined {
    if (i >= s.length)
        return undefined;
    const unit = s.charCodeAt(i);
    if (unit >= 0xD800 && unit <= 0xDBFF && i + 1 < s.length) {
        const next = s.charCodeAt(i + 1);
        if (next >= 0xDC00 && next <= 0xDFFF)
            return s.slice(i, i + 2);
    }
    return s.charAt(i);
}

function remainingLength(run: IDelimiterRun) {
    return run.right - run.left;
}

function violatesRuleOfThree(opener: IDelimiterRun, closer: IDelimiterRun) {
    if (!opener.canClose && !closer.canOpen)
        return false;

    if ((opener.length + closer.length) % 3 !== 0)
        return false;

    return opener.length % 3 !== 0 || closer.length % 3 !== 0;
}

function canPair(opener: IDelimiterRun, closer: IDelimiterRun) {
    return (
        opener.char === closer.char
        && remainingLength(opener) > 0
        && (opener.char === '~'
            ? opener.length === closer.length
            : !violatesRuleOfThree(opener, closer))
    );
}

/** Consumes caller-owned run bounds; returned spans retain offsets in the original source. */
export function pairDelimiters(runs: IDelimiterRun[], offset = 0): Map<number, IDelimiterSpan> {
    const spans = new Map<number, IDelimiterSpan>();
    const openers: number[] = [];

    for (let i = 0; i < runs.length; i++) {
        const closer = runs[i];

        while (closer.canClose && remainingLength(closer) > 0) {
            let top = openers.length - 1;
            while (top >= 0 && !canPair(runs[openers[top]], closer))
                top--;

            if (top < 0)
                break;

            const opener = runs[openers[top]];
            openers.length = top + 1;

            const markerLength = opener.char === '~' ? opener.length : remainingLength(opener) >= 2 && remainingLength(closer) >= 2 ? 2 : 1;
            opener.right -= markerLength;
            closer.left += markerLength;
            const span = {
                start: offset + opener.right,
                end: offset + closer.left,
                markerLength,
            };
            spans.set(span.start, span);

            if (remainingLength(opener) === 0)
                openers.pop();
        }

        if (closer.canOpen && remainingLength(closer) > 0)
            openers.push(i);
    }

    return spans;
}
