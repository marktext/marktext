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

export function getHighlightHtml(src: string, options: ILexOption = {}) {
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
                newlineAfterBlock: false,
            }),
        );
    }

    // marked's default block renderers append newlines purely to
    // pretty-print the serialized HTML. This HTML feeds the export, whose
    // stylesheet renders paragraphs and tight list items pre-wrap — there,
    // every serializer newline shows as a phantom empty line (#4951). Emit
    // compact block joins instead: with them gone, every whitespace byte in
    // the output originates from the author's source (soft breaks, NBSP,
    // raw-HTML formatting), so nothing downstream has to guess — and cannot
    // wrongly guess — which whitespace is authored.
    marked.use({
        renderer: {
            blockquote({ tokens }) {
                return `<blockquote>${this.parser.parse(tokens)}</blockquote>`;
            },
            code(token) {
                return Renderer.prototype.code.call(this, token).replace(/\n$/, '');
            },
            heading(token) {
                return Renderer.prototype.heading.call(this, token).replace(/\n$/, '');
            },
            hr() {
                return '<hr>';
            },
            list(token) {
                let body = '';
                for (const item of token.items)
                    body += this.listitem(item);
                const tag = token.ordered ? 'ol' : 'ul';
                const start
                    = token.ordered && token.start !== 1 ? ` start="${token.start}"` : '';
                return `<${tag}${start}>${body}</${tag}>`;
            },
            listitem(item) {
                return Renderer.prototype.listitem.call(this, item).replace(/\n$/, '');
            },
            paragraph(token) {
                return Renderer.prototype.paragraph.call(this, token).replace(/\n$/, '');
            },
            table(token) {
                return Renderer.prototype.table.call(this, token).replace(/\n$/, '');
            },
        },
    });

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
