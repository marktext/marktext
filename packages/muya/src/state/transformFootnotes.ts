// Convert extension markers to numbered references and footnotes with backrefs.
// Both export paths must run this before DOMPurify strips data-identifier.

const FOOTNOTE_DEF_RE = /<div class="footnote-block" data-identifier="([^"]*)">([\s\S]*?)<\/div>\s*/g;

// The parser already resolves escapes and code spans; only surviving markers are references.
const FOOTNOTE_REF_RE = /<span class="footnote-ref" data-identifier="([^"]*)"><\/span>/g;

export function transformFootnotes(html: string): string {
    const definitions = new Map<string, string>();
    let body = html.replace(FOOTNOTE_DEF_RE, (_, id: string, inner: string) => {
        // The first definition wins for duplicate identifiers.
        if (!definitions.has(id))
            definitions.set(id, inner);
        return '';
    });

    if (definitions.size === 0)
        return unmarkReferences(html);

    // Number by first reference order, not definition order. Unresolved references remain literal.
    const refNumber = new Map<string, number>();
    const refCount = new Map<string, number>();
    let nextN = 1;
    body = body.replace(FOOTNOTE_REF_RE, (_, id: string) => {
        if (!definitions.has(id))
            return literalReference(id);
        if (!refNumber.has(id))
            refNumber.set(id, nextN++);
        const n = refNumber.get(id)!;
        const occurrence = (refCount.get(id) ?? 0) + 1;
        refCount.set(id, occurrence);

        return `<sup class="footnote-ref"><a href="#fn-${n}" id="${refAnchor(n, occurrence)}">${n}</a></sup>`;
    });

    if (refNumber.size === 0)
        return body;

    // Omit definitions that have no references.
    const orderedRefs = Array.from(refNumber.entries()).sort(
        (a, b) => a[1] - b[1],
    );
    const items: string[] = [];
    for (const [id, n] of orderedRefs) {
        // A note body is not a place references resolve — pandoc has no
        // nested notes — so any marker in there reverts to literal text.
        const inner = unmarkReferences(definitions.get(id) ?? '');
        items.push(`<li id="fn-${n}">${appendBackrefs(inner, n, refCount.get(id) ?? 1)}</li>`);
    }

    const section = `\n<section class="footnotes">\n<ol>\n${items.join('\n')}\n</ol>\n</section>\n`;
    return `${body.replace(/\s+$/, '')}\n${section}`;
}

// Identifiers arrive entity-escaped; keep them escaped when restoring literal [^id] text.
function literalReference(escapedIdentifier: string): string {
    return `[^${escapedIdentifier}]`;
}

function unmarkReferences(html: string): string {
    return html.replace(FOOTNOTE_REF_RE, (_, id: string) => literalReference(id));
}

// `id` has to be unique in a document, so only the first reference to a note
// can own the plain `fnref-N`; later ones take a suffix. GFM numbers them the
// same way.
function refAnchor(n: number, occurrence: number): string {
    return occurrence === 1 ? `fnref-${n}` : `fnref-${n}-${occurrence}`;
}

function appendBackrefs(definitionHtml: string, n: number, occurrences: number): string {
    // Number repeated backrefs so each reference remains distinguishable and reachable.
    let backrefs = '';
    for (let k = 1; k <= occurrences; k++) {
        const label = k === 1 ? '↩' : `↩${k}`;
        backrefs += ` <a href="#${refAnchor(n, k)}" class="footnote-backref">${label}</a>`;
    }

    // Inject the backrefs inside the trailing `</p>` so the arrows sit next to
    // the last word of the last paragraph (pandoc style). If the definition
    // doesn't end with a paragraph (rare — e.g. ends in a list), tack them
    // on after the block.
    const lastClose = definitionHtml.lastIndexOf('</p>');
    if (lastClose >= 0)
        return `${definitionHtml.slice(0, lastClose)}${backrefs}${definitionHtml.slice(lastClose)}`;
    return `${definitionHtml}${backrefs}`;
}
