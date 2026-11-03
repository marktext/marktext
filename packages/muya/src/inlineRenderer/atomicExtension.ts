import type { InlineRules } from './rules';
import type { ITokenizerFacOptions } from './types';
import { isLengthEven } from '../utils';
import { matchAt } from './matchAt';
import { BACKSLASH_MATH_RULES } from './rules';

// These extensions render their bodies literally. Their brackets and emphasis
// delimiters must be invisible to both structural scanners when enabled.
function atomicPatterns(char: string, position: number, rules: InlineRules, options: Partial<ITokenizerFacOptions>): RegExp[] {
    const patterns: RegExp[] = [];
    switch (char) {
        case '\\':
            for (const [rule, option] of BACKSLASH_MATH_RULES) {
                if (options[option])
                    patterns.push(rules[rule]);
            }
            break;
        case '$':
            if (options.texMathGfm)
                patterns.push(rules.inline_math_gfm);
            if (options.texMathDollars)
                patterns.push(rules.inline_math);
            break;
        case '[':
            if (options.footnote && position > 0)
                patterns.push(rules.footnote_identifier);
            if (options.inlineDiff)
                patterns.push(...rules.inline_diff);
            break;
        case '{':
            if (options.inlineDiff)
                patterns.push(...rules.inline_diff);
            break;
        case '^':
        case '~':
            if (options.superSubScript)
                patterns.push(char === '^' ? rules.superscript : rules.subscript);
            break;
    }
    return patterns;
}

export function atomicExtensionLength(source: string, index: number, rules: InlineRules, options: Partial<ITokenizerFacOptions>, offset = 0): number {
    const patterns = atomicPatterns(source[index], index + offset, rules, options);
    for (const pattern of patterns) {
        const match = matchAt(pattern, source, index);
        if (match && isLengthEven(match[3]))
            return match[0].length;
    }
    return 0;
}
