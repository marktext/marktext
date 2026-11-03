import type { IHighlight, Labels } from '../model/types';
import type { InlineProfile } from './profiles';

export interface ITokenizerFacOptions {
    superSubScript: boolean;
    footnote: boolean;
    texMathDollars: boolean;
    texMathGfm: boolean;
    texMathSingleBackslash: boolean;
    texMathDoubleBackslash: boolean;
    highlightSyntax: boolean;
    inlineDiff?: boolean;
}

export interface IInlineParseOptions {
    /** Compatibility fallback when profile is omitted. */
    hasBeginRules?: boolean;
    profile?: InlineProfile;
    labels?: Labels;
    options?: Partial<ITokenizerFacOptions>;
}

export interface ITokenizerOptions extends IInlineParseOptions {
    // Block-relative search ranges with nondecreasing starts and ends.
    highlights?: IHighlight[];
}
