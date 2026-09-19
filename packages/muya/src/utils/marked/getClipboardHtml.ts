import type { ILexOption } from './types';
import { EXPORT_DOMPURIFY_CONFIG } from '../../config';
import { sanitize } from '../index';
import cjkEmStrongExtension from './extensions/cjkEmStrong';
import footnoteExtension from './extensions/footnote';
import mathExtension from './extensions/math';
import superSubScriptExtension from './extensions/superSubscript';
import fm, { frontMatterRender } from './frontMatter';
import { LinearMarked } from './linearMarked';
import { DEFAULT_OPTIONS } from './options';
import walkTokens from './walkTokens';

export function getClipBoardHtml(src: string, options: ILexOption = {}) {
    options = Object.assign({}, DEFAULT_OPTIONS, options);
    const { footnote, frontMatter, texMathDollars, isGitlabCompatibilityEnabled, superSubScript }
        = options;
    let html = '';

    // Use a fresh Marked instance per call to avoid polluting the global
    // `marked` singleton — `.use({ walkTokens })` chains rather than replaces,
    // and the global is shared with anything else in the bundle that imports
    // `marked`.
    const marked = new LinearMarked();

    marked.use({
        walkTokens: walkTokens({ texMathDollars, isGitlabCompatibilityEnabled }),
    });

    // CJK-as-punctuation emphasis flanking (marktext/marktext#4307); keeps the
    // clipboard HTML consistent with the static / export render path.
    marked.use(cjkEmStrongExtension());

    if (texMathDollars) {
        marked.use(
            mathExtension({
                throwOnError: false,
                useKatexRender: false,
            }),
        );
    }

    if (superSubScript)
        marked.use(superSubScriptExtension());

    if (footnote)
        marked.use(footnoteExtension());

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
