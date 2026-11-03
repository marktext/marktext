import type { Rules } from '../model/types';
import type { ICodeSpanMatch, ICodeSpanReader } from './codeSpan';
import { CodeSpanScanner } from './codeSpan';

export function lowerPriority(src: string, offset: number, rules: Rules, start = 0, codeSpans?: ICodeSpanReader) {
    let i;
    const patterns = Object.values(rules);

    for (i = start; i < offset; i++) {
        // A character preceded by an odd number of backslashes is escaped
        // (e.g. `\$`), so it cannot open a higher-priority construct such as
        // inline math/code and must not lower the surrounding emphasis.
        let backslashes = 0;
        for (let j = i - 1; j >= 0 && src[j] === '\\'; j--)
            backslashes++;
        if (backslashes % 2 === 1)
            continue;

        const text = src.substring(i);

        if (text[0] === '`') {
            codeSpans ??= new CodeSpanScanner(src);
            const code: ICodeSpanMatch = codeSpans.read(i)!;
            if (code.closed && code.end > offset)
                return false;
            i = code.end - 1;
            continue;
        }

        for (const regexp of patterns) {
            const to = regexp.exec(text);
            if (to && to[0].length > offset - i)
                return false;
            if (to) {
                // Backticks and brackets inside an HTML token cannot open another construct.
                i += to[0].length - 1;
                break;
            }
        }
    }

    return true;
}
