import type { IInlineFeatures } from './types';

const DEFAULT_FEATURES: Readonly<IInlineFeatures> = {
    cjkEmphasis: true,
    superSubScript: true,
    footnote: false,
    texMathDollars: true,
    texMathGfm: false,
    texMathSingleBackslash: false,
    texMathDoubleBackslash: false,
    highlightSyntax: false,
    inlineDiff: false,
};

export function resolveInlineFeatures(options: Partial<IInlineFeatures> = {}): IInlineFeatures {
    return { ...DEFAULT_FEATURES, ...options };
}
