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
        // ONE authoritative protection state, replacing marked's own
        // tracking (a single boolean over pre/code/kbd/script that ANY list
        // member's close tag exits — a literal "</code>" inside a script
        // both un-protects and mis-escapes the remainder — and that misses
        // textarea/style/title entirely). Two semantic tiers:
        //
        // - script/style/title/textarea are true HTML raw-text: once
        //   inside, every other tag is plain content and only the
        //   SAME-NAME closing tag exits — a single slot.
        // - pre/code/kbd are ordinary containers marked merely refuses to
        //   parse markdown inside; they nest legally (same-name included),
        //   so they need a stack. An end tag closes its nearest matching
        //   open plus anything above it, like the HTML parser would.
        //
        // Transitions are scanned from EVERY html token's text, block
        // tokens included: marked's type-6 blocks end at a blank line, so
        // a block token can carry an unmatched open (or the close of an
        // element opened inline). Comments are stripped first — their
        // content is never markup. Self-closing-style tags (`<textarea/>`,
        // `</textarea/>`) count like their plain forms: browsers ignore
        // that flag on non-void elements.
        const RAW_TEXT_TAGS = new Set(['script', 'style', 'title', 'textarea']);
        let rawTextTag: string | null = null;
        const containerStack: string[] = [];
        const transition = (tag: string, isClose: boolean) => {
            if (rawTextTag !== null) {
                if (isClose && tag === rawTextTag)
                    rawTextTag = null;
                return;
            }
            if (RAW_TEXT_TAGS.has(tag)) {
                if (!isClose)
                    rawTextTag = tag;
                return;
            }
            if (!isClose) {
                containerStack.push(tag);
                return;
            }
            const openIndex = containerStack.lastIndexOf(tag);
            if (openIndex >= 0)
                containerStack.length = openIndex;
        };
        const isProtected = () => rawTextTag !== null || containerStack.length > 0;
        marked.use({
            renderer: {
                html(token) {
                    const text = token.text.replace(/<!--[\s\S]*?-->/g, '');
                    const tagPattern
                        = /<(\/?)(pre|code|kbd|script|textarea|style|title)(?=[\s/>])/gi;
                    let match = tagPattern.exec(text);
                    while (match !== null) {
                        transition(match[2].toLowerCase(), match[1] === '/');
                        match = tagPattern.exec(text);
                    }
                    return Renderer.prototype.html.call(this, token);
                },
                text(token) {
                    // Block-level text tokens carry children whose inline
                    // pieces (raw HTML among them) are already rendered —
                    // only LEAF text can contain authored soft breaks. Code
                    // spans, raw HTML, and hard breaks are separate token
                    // types.
                    if ('tokens' in token && token.tokens)
                        return Renderer.prototype.text.call(this, token);

                    // Recompute `escaped` from the authoritative state: a
                    // leaf inside raw text or a container is emitted
                    // verbatim even when marked's mis-tracked flag says
                    // otherwise (the base renderer would HTML-escape real
                    // script content), and a leaf outside is escaped
                    // normally with its soft breaks rendered as <br>.
                    // (Global-regex `replace`, not `replaceAll` — the build
                    // targets chrome70.)
                    if (rawTextTag !== null) {
                        // marked's inline tag rule rejects self-closing-style
                        // end tags (`</textarea/>`), so such a close arrives
                        // INSIDE a text leaf: keep everything through it
                        // verbatim, exit the state, and process the rest of
                        // the leaf normally.
                        const close = new RegExp(`</${rawTextTag}[\\s/]*>`, 'i')
                            .exec(token.text);
                        if (close !== null) {
                            const cut = close.index + close[0].length;
                            const head = token.text.slice(0, cut);
                            const tail = token.text.slice(cut);
                            rawTextTag = null;
                            const tailHtml = Renderer.prototype.text.call(
                                this,
                                { ...token, raw: tail, text: tail, escaped: false },
                            );
                            return head + tailHtml.replace(/\n/g, '<br>');
                        }
                        return Renderer.prototype.text.call(this, { ...token, escaped: true });
                    }
                    if (isProtected())
                        return Renderer.prototype.text.call(this, { ...token, escaped: true });

                    const html = Renderer.prototype.text.call(this, { ...token, escaped: false });
                    return html.replace(/\n/g, '<br>');
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
