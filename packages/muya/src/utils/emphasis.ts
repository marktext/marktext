export interface IEmphasisSpan {
    start: number;
    end: number;
    markerLen: number;
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

function unspent(run: IDelimiterRun) {
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
        && unspent(opener) > 0
        && (opener.char === '~'
            ? opener.length === closer.length
            : !violatesRuleOfThree(opener, closer))
    );
}

/** Consumes caller-owned run bounds; returned spans retain offsets in the original source. */
export function pairEmphasisDelimiters(runs: IDelimiterRun[], base = 0): Map<number, IEmphasisSpan> {
    const spans = new Map<number, IEmphasisSpan>();
    const openers: number[] = [];

    for (let i = 0; i < runs.length; i++) {
        const closer = runs[i];

        while (closer.canClose && unspent(closer) > 0) {
            let top = openers.length - 1;
            while (top >= 0 && !canPair(runs[openers[top]], closer))
                top--;

            if (top < 0)
                break;

            const opener = runs[openers[top]];
            openers.length = top + 1;

            const markerLen = opener.char === '~' ? opener.length : unspent(opener) >= 2 && unspent(closer) >= 2 ? 2 : 1;
            opener.right -= markerLen;
            closer.left += markerLen;
            spans.set(base + opener.right, {
                start: base + opener.right,
                end: base + closer.left,
                markerLen,
            });

            if (unspent(opener) === 0)
                openers.pop();
        }

        if (closer.canOpen && unspent(closer) > 0)
            openers.push(i);
    }

    return spans;
}
