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
     * Export soft-break markup (#4951): mark markdown-GENERATED paragraphs
     * and list items with `data-md` so the export stylesheet can scope its
     * pre-wrap soft-break rendering to them — raw HTML passed through
     * verbatim carries no marker and keeps normal whitespace semantics —
     * and join a tight list item's DIRECT children without marked's
     * serializer newlines, which the item's pre-wrap would render as
     * phantom empty lines. Everything else keeps marked's canonical
     * output: the block separators are load-bearing for user export themes
     * that restyle blocks `display: inline`, and the CommonMark/GFM
     * conformance suites normalize against them.
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
                paragraph(token) {
                    const html = Renderer.prototype.paragraph.call(this, token);
                    // Only ever tag the paragraph's own opening tag - inline
                    // raw HTML inside the paragraph is authored bytes.
                    return html.startsWith('<p>')
                        ? `<p data-md>${html.slice('<p>'.length)}`
                        : html;
                },
                listitem(item) {
                    if (item.loose) {
                        const html = Renderer.prototype.listitem.call(this, item);
                        return html.startsWith('<li>')
                            ? `<li data-md>${html.slice('<li>'.length)}`
                            : html;
                    }

                    // A tight item's DIRECT children sit under the item's
                    // pre-wrap, where every serializer newline renders as a
                    // phantom empty line - join them without marked's block
                    // separators. Nested containers keep their canonical
                    // interior; the export stylesheet resets them to normal
                    // whitespace semantics.
                    let body = '';
                    for (const child of item.tokens) {
                        body += this.parser
                            .parse([child])
                            .replace(/^\n+/, '')
                            .replace(/\n+$/, '');
                    }
                    return `<li data-md>${body}</li>\n`;
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
