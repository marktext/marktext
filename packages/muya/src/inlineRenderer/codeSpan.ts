interface IBacktickRun {
    end: number;
    closer?: number;
}

export interface ICodeSpanMatch {
    // Exclusive UTF-16 offset in the scanner's source, immediately after the closing or unmatched run.
    end: number;
    markerLength: number;
    closed: boolean;
}

export interface ICodeSpanReader {
    read: (index: number) => ICodeSpanMatch | null;
}

// Index complete runs once per inline source so unmatched openers cannot repeatedly
// search the remaining paragraph. Escapes affect openers, but never code-span closers.
export class CodeSpanScanner {
    private _runs = new Map<number, IBacktickRun>();
    private _startsByLength = new Map<number, number[]>();

    constructor(private _source: string) {
        const nextByLength = new Map<number, number>();
        const runs = [..._source.matchAll(/`+/g)];
        for (let i = runs.length - 1; i >= 0; i--) {
            const { index, 0: marker } = runs[i];
            this._runs.set(index, { end: index + marker.length, closer: nextByLength.get(marker.length) });
            const starts = this._startsByLength.get(marker.length) ?? [];
            starts.push(index);
            this._startsByLength.set(marker.length, starts);
            nextByLength.set(marker.length, index);
        }
    }

    read(index: number): ICodeSpanMatch | null {
        if (this._source[index] !== '`')
            return null;

        const run = this._runs.get(index);
        let end = run?.end ?? index;
        if (!run) {
            // Escaping the first backtick of a run can expose its suffix as an opener.
            while (this._source[end] === '`')
                end++;
        }
        const markerLength = end - index;
        const closer = run ? run.closer : this._closerAfter(markerLength, end);

        return { end: closer === undefined ? end : closer + markerLength, markerLength, closed: closer !== undefined };
    }

    /** Child-relative offsets over this index; closers outside [start, end) remain unmatched. */
    view(start: number, end: number): ICodeSpanReader {
        return {
            read: (index) => {
                if (index < 0 || start + index >= end)
                    return null;
                const match = this.read(start + index);
                if (!match)
                    return null;
                const markerLength = Math.min(match.markerLength, end - start - index);
                return {
                    markerLength,
                    end: match.end <= end ? match.end - start : index + markerLength,
                    closed: match.closed && match.end <= end,
                };
            },
        };
    }

    private _closerAfter(length: number, end: number): number | undefined {
        const starts = this._startsByLength.get(length) ?? [];
        let left = 0;
        let right = starts.length;
        while (left < right) {
            const mid = (left + right) >>> 1;
            if (starts[mid] >= end)
                left = mid + 1;
            else
                right = mid;
        }
        return left > 0 ? starts[left - 1] : undefined;
    }
}

export function codeSpanContent(source: string) {
    let content = source.replace(/\r\n?|\n/g, ' ');
    let leading = 0;
    let trailing = 0;
    if (content.startsWith(' ') && content.endsWith(' ') && /[^ ]/.test(content)) {
        content = content.slice(1, -1);
        leading = /^(?:\r\n?|[\n ])/.exec(source)![0].length;
        trailing = /(?:\r\n|[\r\n ])$/.exec(source)![0].length;
    }
    return { content, leading, trailing };
}
