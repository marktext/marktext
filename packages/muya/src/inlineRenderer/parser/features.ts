import type { ITokenizerFacOptions } from './types';

const DEFAULT_FEATURES: Readonly<Required<ITokenizerFacOptions>> = {
    superSubScript: true,
    footnote: false,
    texMathDollars: true,
    texMathGfm: false,
    texMathSingleBackslash: false,
    texMathDoubleBackslash: false,
    highlightSyntax: false,
    inlineDiff: false,
};

export function resolveInlineFeatures(options: Partial<ITokenizerFacOptions> = {}): ITokenizerFacOptions {
    return { ...DEFAULT_FEATURES, ...options };
}
