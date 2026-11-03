import type { InlineRules } from './rules';
import type { IInlineFeatures } from './types';
import { isLengthEven } from '../../utils';
import { matchAt } from './matchAt';
import { BACKSLASH_MATH_RULES } from './rules';

export type AtomicRule = typeof BACKSLASH_MATH_RULES[number][0]
    | 'inline_math_gfm' | 'inline_math' | 'inline_diff' | 'footnote_identifier' | 'superscript' | 'subscript';

function enabled(rule: AtomicRule, options: IInlineFeatures, position: number): boolean {
    switch (rule) {
        case 'inline_math_gfm': return !!options.texMathGfm;
        case 'inline_math': return !!options.texMathDollars;
        case 'inline_diff': return !!options.inlineDiff;
        case 'footnote_identifier': return !!options.footnote && position > 0;
        case 'superscript':
        case 'subscript': return !!options.superSubScript;
        default: return BACKSLASH_MATH_RULES.some(([name, option]) => name === rule && options[option]);
    }
}

/** Shared recognition for token consumption and structural protection; priority belongs to callers. */
export function matchExtension(rule: AtomicRule, source: string, index: number, rules: InlineRules, options: IInlineFeatures, offset = 0): RegExpExecArray | null {
    if (!enabled(rule, options, index + offset))
        return null;
    const value = rules[rule];
    for (const pattern of Array.isArray(value) ? value : [value]) {
        const match = matchAt(pattern, source, index);
        if (match && isLengthEven(match[3]))
            return match;
    }
    return null;
}

function candidates(char: string): readonly AtomicRule[] {
    switch (char) {
        case '\\': return BACKSLASH_MATH_RULES.map(([rule]) => rule);
        case '$': return ['inline_math_gfm', 'inline_math'];
        case '[': return ['footnote_identifier', 'inline_diff'];
        case '{': return ['inline_diff'];
        case '^': return ['superscript'];
        case '~': return ['subscript'];
        default: return [];
    }
}

export function atomicExtensionLength(source: string, index: number, rules: InlineRules, options: IInlineFeatures, offset = 0): number {
    for (const rule of candidates(source[index])) {
        const match = matchExtension(rule, source, index, rules, options, offset);
        if (match)
            return match[0].length;
    }
    return 0;
}
