import type { IDelimiterSpan } from '../../utils/delimiters';
import type { HTMLTagToken, ImageToken, Labels, ReferenceImageToken, Token } from '../model/types';
import type { BracketScanner } from './brackets';
import type { CodeSpanScanner, ICodeSpanReader } from './codeSpan';
import type { IBlockProfile } from './profiles';
import type { HtmlTagScanner } from './rawHtml';
import type { BeginRules, InlineRules } from './rules';
import type { SourceWindow } from './sourceWindow';
import type { ITokenizerFacOptions } from './types';

export interface IInlineContent {
    source: string;
    position: number;
    token: ImageToken | ReferenceImageToken | HTMLTagToken;
    tokens: Token[];
}

export interface ILexContext {
    window: SourceWindow;
    codeSpans: CodeSpanScanner;
    brackets: BracketScanner;
    htmlTags: HtmlTagScanner;
    // One root-owned queue keeps unbounded HTML/image nesting off the JS call stack.
    inlineContents: IInlineContent[];
}

// Mutable cursor + accumulator threaded through every inline-rule handler.
// `src`/`pos` advance as input is consumed; `pending`/`pendingStartPos`
// accumulate plain text between matched tokens; `tokens` collects the output.
export interface ILexState {
    parseFrame: (source: string, options: IParseFrameOptions) => Token[];
    codeSpans: ICodeSpanReader;
    context: ILexContext;
    window: SourceWindow;
    src: string;
    pos: number;
    pending: string;
    pendingStartPos: number;
    tokens: Token[];
    delimiterSpans: Map<number, IDelimiterSpan> | null;
    inlineRules: InlineRules;
    labels: Labels;
    options: ITokenizerFacOptions;
    top: boolean;
    allowAutolinks: boolean;
}

export interface IParseFrameOptions {
    beginRules: BeginRules | null;
    inlineRules: InlineRules;
    pos: number;
    top: boolean;
    labels: Labels;
    options: ITokenizerFacOptions;
    delimiterSpans?: Map<number, IDelimiterSpan> | null;
    allowAutolinks?: boolean;
    parentContext?: ILexContext;
    profile?: IBlockProfile;
}

export interface IChunkMatch {
    rule: 'inline_math_gfm' | 'mark' | 'inline_diff' | 'emoji' | 'inline_math';
    to: RegExpExecArray;
}
