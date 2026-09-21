// Post-process the marked footnote extension's raw output into the standard
// GFM / pandoc shape: inline numbered `<sup class="footnote-ref">` markers plus
// a bottom `<section class="footnotes">` list with backrefs.
//
// Shared by both export paths — the async `MarkdownToHtml` (styled HTML / PDF /
// print) and the synchronous `renderToStaticHTML` (spec conformance). Must run
// on the raw marked output BEFORE DOMPurify, because the `data-identifier`
// marker the footnote extension emits is stripped by the default export config.

const FOOTNOTE_DEF_RE = /<div class="footnote-block" data-identifier="([^"]*)">([\s\S]*?)<\/div>\s*/g;

// Inline reference markers, emitted by the same extension's inline rule. The
// extension resolves what is and isn't a reference while the source is still
// tokenisable — escapes, code spans and fenced code are all settled there —
// so this pass only has to number what survived.
const FOOTNOTE_REF_RE = /<span class="footnote-ref" data-identifier="([^"]*)"><\/span>/g;

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
        return unmarkReferences(html);

    // 2. Number the surviving reference markers in the order they appear.
    //    Numbering follows inline order (pandoc / GFM convention), not the
    //    order definitions appear in source. Orphan refs (no matching def)
    //    fall back to literal text; repeats reuse the first-seen number.
    const refNumber = new Map<string, number>();
    let nextN = 1;
    body = body.replace(FOOTNOTE_REF_RE, (_, id: string) => {
        if (!definitions.has(id))
            return literalReference(id);
        if (!refNumber.has(id))
            refNumber.set(id, nextN++);
        const n = refNumber.get(id)!;
        return `<sup class="footnote-ref"><a href="#fn-${n}" id="fnref-${n}">${n}</a></sup>`;
    });

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
        // A note body is not a place references resolve — pandoc has no
        // nested notes — so any marker in there reverts to literal text.
        const inner = unmarkReferences(definitions.get(id) ?? '');
        items.push(`<li id="fn-${n}">${appendBackref(inner, n)}</li>`);
    }

    const section = `\n<section class="footnotes">\n<ol>\n${items.join('\n')}\n</ol>\n</section>\n`;
    return `${body.replace(/\s+$/, '')}\n${section}`;
}

// Undo the extension's marker, restoring the `[^id]` the author typed. An
// identifier may hold `&`, `<` or `>` (the rule only bars `^`, `[`, `]` and
// whitespace), and it arrives already entity-escaped from the marker's
// attribute. Entities read the same as text, so it is re-emitted untouched
// rather than unescaped into markup.
function literalReference(escapedIdentifier: string): string {
    return `[^${escapedIdentifier}]`;
}

function unmarkReferences(html: string): string {
    return html.replace(FOOTNOTE_REF_RE, (_, id: string) => literalReference(id));
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
