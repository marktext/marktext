import type { ILexOption } from './types';
import { Marked, Renderer } from 'marked';
import { markedHighlight } from 'marked-highlight';
import Prism from 'prismjs';
import cjkEmStrongExtension from './extensions/cjkEmStrong';
import emojiExtension from './extensions/emoji';
import footnoteExtension from './extensions/footnote';
import mathExtension from './extensions/math';
import superSubScriptExtension from './extensions/superSubscript';
import fm, { frontMatterRender } from './frontMatter';
import { DEFAULT_OPTIONS } from './options';
import walkTokens from './walkTokens';

const DIAGRAM_TYPE = [
    'mermaid',
    'plantuml',
    'vega-lite',
    'flowchart',
    'sequence',
];

function highlight(code: string, lang: string) {
    // Language may be undefined (GH#591)
    if (!lang)
        return code;

    if (DIAGRAM_TYPE.includes(lang))
        return code;

    const grammar = Prism.languages[lang];
    if (!grammar) {
        console.warn(`Unable to find grammar for "${lang}".`);
        return code;
    }
    return Prism.highlight(code, grammar, lang);
}

export interface IHighlightHtmlOptions {
    /**
     * Render authored soft line breaks as `<br>` (#3676, #4951). CommonMark
     * explicitly permits a renderer option that outputs soft breaks as hard
     * line breaks; doing it AT THE INLINE TOKEN - the only place the parser
     * itself distinguishes an authored soft break from raw-HTML formatting
     * or its own serializer newlines - needs no stylesheet cooperation, so
     * raw HTML, user export themes, and marked's canonical block output all
     * stay byte-for-byte untouched. (The presentation-layer alternative,
     * pre-wrap on containers, re-interprets EVERY newline it inherits into
     * and was withdrawn after repeated review counterexamples.) Off by
     * default: the editor and the CommonMark/GFM conformance renderer keep
     * spec-canonical output.
     */
    exportSoftBreaks?: boolean;
}

export function getHighlightHtml(
    src: string,
    options: ILexOption = {},
    { exportSoftBreaks = false }: IHighlightHtmlOptions = {},
) {
    options = Object.assign({}, DEFAULT_OPTIONS, options);
    const { footnote, frontMatter, math, isGitlabCompatibilityEnabled, superSubScript }
        = options;

    // Build a fresh Marked instance per call. `Marked.use({ walkTokens })`
    // chains rather than replaces, so reusing a module-level singleton would
    // cause walkTokens to fire N times after N invocations and corrupt token
    // state (e.g. wiping `lang` on subsequent runs).
    const marked = new Marked(markedHighlight({ highlight }));

    marked.use({
        walkTokens: walkTokens({ math, isGitlabCompatibilityEnabled }),
    });

    // Treat CJK characters as punctuation for emphasis/strong flanking so
    // `中文**"加粗"**中文` bolds (marktext/marktext#4307). Additive override —
    // never regresses spec-conformant Latin emphasis.
    marked.use(cjkEmStrongExtension());

    marked.use(emojiExtension({ isRenderEmoji: true }));

    if (math) {
        marked.use(
            mathExtension({
                throwOnError: false,
                useKatexRender: true,
            }),
        );
    }

    if (exportSoftBreaks) {
        marked.use({
            renderer: {
                text(token) {
                    const html = Renderer.prototype.text.call(this, token);
                    // Block-level text tokens carry children whose inline
                    // pieces (raw HTML among them) are already rendered -
                    // only LEAF text can contain authored soft breaks. Code
                    // spans, inline raw HTML, and hard breaks are separate
                    // token types and never reach this replacement.
                    if ('tokens' in token && token.tokens)
                        return html;
                    return html.replaceAll('\n', '<br>');
                },
            },
        });
    }

    if (superSubScript)
        marked.use(superSubScriptExtension());

    if (footnote)
        marked.use(footnoteExtension());

    let html = '';

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
