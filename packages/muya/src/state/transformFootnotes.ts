// Post-process the marked footnote extension's raw output into the standard
// GFM / pandoc shape: inline numbered `<sup class="footnote-ref">` markers plus
// a bottom `<section class="footnotes">` list with backrefs.
//
// Shared by both export paths — the async `MarkdownToHtml` (styled HTML / PDF /
// print) and the synchronous `renderToStaticHTML` (spec conformance). Must run
// on the raw marked output BEFORE DOMPurify, because the `data-identifier`
// marker the footnote extension emits is stripped by the default export config.

const FOOTNOTE_DEF_RE = /<div class="footnote-block" data-identifier="([^"]*)">([\s\S]*?)<\/div>\s*/g;

// Inline `[^id]` syntax. Identifier matches the marked footnote extension's
// block rule (utils/marked/extensions/footnote.ts: `[^^[\]\s]+`) so any id
// the block accepts as a definition can also be picked up as a reference.
const FOOTNOTE_REF_RE = /\[\^([^[\]\s]+)\]/g;

// Pre/code blocks need to opt out: `[^id]` inside `<code>` or `<pre>` is
// content, not a reference. We blank them out before scanning for refs and
// restore them afterwards. The non-greedy match is enough since neither
// element supports nesting itself in valid HTML.
const CODE_GUARD_RE = /<(code|pre)\b[^>]*>[\s\S]*?<\/\1>/g;

// Placeholder used to mask code spans / blocks while we scan for inline
// `[^id]` references. The mid-string `_MUYA_FN_GUARD_` token can't appear in
// marked's HTML output (no rule emits it), so the restore step is unambiguous.
const CODE_PLACEHOLDER_PREFIX = '_MUYA_FN_GUARD_';
const CODE_PLACEHOLDER_RESTORE_RE = /_MUYA_FN_GUARD_(\d+)_/g;

export function transformFootnotes(html: string): string {
    // 1. Lift every footnote-block out of the body, remembering the rendered
    //    definition html keyed by identifier. The body of the def is the inner
    //    html marked already produced — paragraphs, lists, code, etc.
    const definitions = new Map<string, string>();
    let body = html.replace(FOOTNOTE_DEF_RE, (_, id: string, inner: string) => {
        // First definition wins for duplicate identifiers — matches the way
        // pandoc / GFM linkrefs treat repeated labels and what the plan asks
        // for (Section 10, risk #2).
        if (!definitions.has(id))
            definitions.set(id, inner);
        return '';
    });

    if (definitions.size === 0)
        return html;

    // 2. Stash code spans / blocks so step 3 only scans live prose.
    const codeSlots: string[] = [];
    body = body.replace(CODE_GUARD_RE, (m) => {
        codeSlots.push(m);
        return `${CODE_PLACEHOLDER_PREFIX}${codeSlots.length - 1}_`;
    });

    // 3. Find inline `[^id]` references in source order. Numbering follows
    //    inline order (pandoc / GFM convention), not the order definitions
    //    appear in source. Orphan refs (no matching def) stay as plain text;
    //    repeats reuse the first-seen number.
    const refNumber = new Map<string, number>();
    let nextN = 1;
    body = body.replace(FOOTNOTE_REF_RE, (match, id: string) => {
        if (!definitions.has(id))
            return match;
        if (!refNumber.has(id))
            refNumber.set(id, nextN++);
        const n = refNumber.get(id)!;
        return `<sup class="footnote-ref"><a href="#fn-${n}" id="fnref-${n}">${n}</a></sup>`;
    });

    // 4. Restore the protected code regions.
    body = body.replace(CODE_PLACEHOLDER_RESTORE_RE, (_, i) => codeSlots[Number(i)]);

    if (refNumber.size === 0)
        return body;

    // 5. Build the footnotes section in numeric order. Orphan definitions
    //    (defined but never referenced inline) are dropped — same as the
    //    parser-extension behaviour marktext shipped.
    const orderedRefs = Array.from(refNumber.entries()).sort(
        (a, b) => a[1] - b[1],
    );
    const items: string[] = [];
    for (const [id, n] of orderedRefs) {
        const inner = definitions.get(id) ?? '';
        items.push(`<li id="fn-${n}">${appendBackref(inner, n)}</li>`);
    }

    const section = `\n<section class="footnotes">\n<ol>\n${items.join('\n')}\n</ol>\n</section>\n`;
    return `${body.replace(/\s+$/, '')}\n${section}`;
}

function appendBackref(definitionHtml: string, n: number): string {
    const backref = ` <a href="#fnref-${n}" class="footnote-backref">↩</a>`;
    // Inject the backref inside the trailing `</p>` so the arrow sits next to
    // the last word of the last paragraph (pandoc style). If the definition
    // doesn't end with a paragraph (rare — e.g. ends in a list), tack the
    // backref on after the block.
    const lastClose = definitionHtml.lastIndexOf('</p>');
    if (lastClose >= 0)
        return `${definitionHtml.slice(0, lastClose)}${backref}${definitionHtml.slice(lastClose)}`;
    return `${definitionHtml}${backref}`;
}
