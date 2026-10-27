import type { ILexOption } from './types';
import { Marked } from 'marked';
import { EXPORT_DOMPURIFY_CONFIG } from '../../config';
import { sanitize } from '../index';
import fancyListsHtmlExtension from './extensions/fancyListsHtml';
import footnoteExtension from './extensions/footnote';
import githubAlertsExtension from './extensions/githubAlerts';
import inlineDelimitersExtension from './extensions/inlineDelimiters';
import inlineDiffExtension from './extensions/inlineDiff';
import markExtension from './extensions/mark';
import mathExtension, { doubleBackslashMathExtension, gfmMathExtension, singleBackslashMathExtension } from './extensions/math';
import multilineBlockquoteExtension from './extensions/multilineBlockquote';
import superSubScriptExtension from './extensions/superSubscript';
import fm, { frontMatterRender } from './frontMatter';
import { DEFAULT_OPTIONS } from './options';
import walkTokens from './walkTokens';

export function getClipBoardHtml(src: string, options: ILexOption = {}) {
    options = Object.assign({}, DEFAULT_OPTIONS, options);
    const { footnote, frontMatter, texMathDollars, texMathGfm, texMathSingleBackslash, texMathDoubleBackslash, superSubScript, highlightSyntax, inlineDiff, multilineBlockquote, fancyLists }
        = options;
    let html = '';

    // Use a fresh Marked instance; global use() chains hooks and leaks options across renders.
    const marked = new Marked();

    marked.use({
        walkTokens: walkTokens({ texMathDollars, texMathGfm }),
    });

    marked.use(inlineDelimitersExtension());

    if (texMathDollars) {
        marked.use(
            mathExtension({
                throwOnError: false,
                useKatexRender: false,
            }),
        );
    }

    if (texMathGfm) {
        marked.use(
            gfmMathExtension({
                throwOnError: false,
                useKatexRender: false,
            }),
        );
    }

    if (texMathSingleBackslash) {
        marked.use(
            singleBackslashMathExtension({
                throwOnError: false,
                useKatexRender: false,
            }),
        );
    }

    if (texMathDoubleBackslash) {
        marked.use(
            doubleBackslashMathExtension({
                throwOnError: false,
                useKatexRender: false,
            }),
        );
    }

    if (superSubScript)
        marked.use(superSubScriptExtension());

    if (highlightSyntax)
        marked.use(markExtension());

    if (inlineDiff)
        marked.use(inlineDiffExtension());

    marked.use(multilineBlockquoteExtension(multilineBlockquote === true));
    marked.use(githubAlertsExtension(options.githubAlerts === true));

    if (footnote)
        marked.use(footnoteExtension());

    if (fancyLists)
        marked.use(fancyListsHtmlExtension());

    if (frontMatter) {
        const { token, src: newSrc } = fm(src);
        if (token) {
            html = frontMatterRender(token);
            src = newSrc;
        }
    }

    html += marked.parse(src);

    return html;
}

export function getSanitizeClipboardHtml(src: string, options: ILexOption = {}) {
    const html = getClipBoardHtml(src, options);

    return sanitize(html, EXPORT_DOMPURIFY_CONFIG, false) as string;
}
