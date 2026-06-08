import type { ILexOption } from './types';
import { Marked } from 'marked';
import cjkEmStrongExtension from './extensions/cjkEmStrong';
import mathExtension from './extensions/math';
import superSubScriptExtension from './extensions/superSubscript';
import fm, { frontMatterRender } from './frontMatter';
import { DEFAULT_OPTIONS } from './options';
import walkTokens from './walkTokens';

export function getClipBoardHtml(src: string, options: ILexOption = {}) {
    options = Object.assign({}, DEFAULT_OPTIONS, options);
    const { frontMatter, math, isGitlabCompatibilityEnabled, superSubScript }
        = options;
    let html = '';

    // Use a fresh Marked instance per call to avoid polluting the global
    // `marked` singleton — `.use({ walkTokens })` chains rather than replaces,
    // and the global is shared with anything else in the bundle that imports
    // `marked`.
    const marked = new Marked();

    marked.use({
        walkTokens: walkTokens({ math, isGitlabCompatibilityEnabled }),
    });

    // CJK-as-punctuation emphasis flanking (marktext/marktext#4307); keeps the
    // clipboard HTML consistent with the static / export render path.
    marked.use(cjkEmStrongExtension());

    if (math) {
        marked.use(
            mathExtension({
                throwOnError: false,
                useKatexRender: false,
            }),
        );
    }

    if (superSubScript)
        marked.use(superSubScriptExtension());

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
