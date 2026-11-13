import type { IHighlight, Labels } from '../model/types';
import type { InlineProfile } from './profiles';

export interface IInlineFeatures {
    cjkEmphasis: boolean;
    superSubScript: boolean;
    footnote: boolean;
    texMathDollars: boolean;
    texMathGfm: boolean;
    texMathSingleBackslash: boolean;
    texMathDoubleBackslash: boolean;
    highlightSyntax: boolean;
    inlineDiff: boolean;
}

export interface IInlineParseOptions {
    profile?: InlineProfile;
    labels?: Labels;
    options?: Partial<IInlineFeatures>;
}

export interface ITokenizerOptions extends IInlineParseOptions {
    // Block-relative search ranges with nondecreasing starts and ends.
    highlights?: IHighlight[];
}
