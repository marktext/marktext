import { getHighlightHtml } from '../utils/marked';
import { sanitizeExportHtml } from '../utils/sanitizeExportHtml';
import { transformFootnotes } from './transformFootnotes';

export interface IRenderToStaticHTMLOptions {
    footnote?: boolean;
    texMathDollars?: boolean;
    texMathGfm?: boolean;
    texMathSingleBackslash?: boolean;
    texMathDoubleBackslash?: boolean;
    superSubScript?: boolean;
    frontMatter?: boolean;
    highlightSyntax?: boolean;
    inlineDiff?: boolean;
    multilineBlockquote?: boolean;
    githubAlerts?: boolean;
    // Disabling sanitization permits untrusted HTML; intended only for spec conformance runners.
    sanitize?: boolean;
}

/**
 * Synchronous markdown → HTML renderer used by the CommonMark / GFM spec
 * conformance runners and by any consumer that wants a Promise-free render.
 *
 * Differences from `MarkdownToHtml`:
 *  - Synchronous: no mermaid / vega-lite / plantuml diagram rendering. Diagram
 *    code blocks remain inert `<pre><code class="language-*">…</code></pre>`
 *    placeholders. Consumers that want live diagrams should keep using the
 *    async `MarkdownToHtml`.
 *  - Returns the bare body HTML — no `<article class="markdown-body">` wrapper,
 *    no `<!DOCTYPE>` / `<head>` / styles. The spec runner compares raw block
 *    HTML against CommonMark / GFM expected output.
 *  - Sanitizes via the same `EXPORT_DOMPURIFY_CONFIG` as `MarkdownToHtml`, so
 *    XSS payloads (script tags, event-handler attributes, `javascript:` URLs)
 *    are stripped consistently with the live editor's export path.
 *
 * Empty input fast-paths to an empty string so callers don't have to special
 * case it.
 */
export function renderToStaticHTML(
    markdown: string,
    options: IRenderToStaticHTMLOptions = {},
): string {
    if (!markdown)
        return '';

    const footnote = options.footnote ?? false;

    let html = getHighlightHtml(markdown, {
        footnote,
        texMathDollars: options.texMathDollars ?? true,
        texMathGfm: options.texMathGfm ?? false,
        texMathSingleBackslash: options.texMathSingleBackslash ?? false,
        texMathDoubleBackslash: options.texMathDoubleBackslash ?? false,
        superSubScript: options.superSubScript ?? true,
        frontMatter: options.frontMatter ?? false,
        highlightSyntax: options.highlightSyntax ?? false,
        inlineDiff: options.inlineDiff ?? false,
        multilineBlockquote: options.multilineBlockquote ?? false,
        githubAlerts: options.githubAlerts ?? false,
    });

    // Transform footnotes before DOMPurify strips their data-identifier markers.
    if (footnote)
        html = transformFootnotes(html);

    if (options.sanitize === false)
        return html;

    return sanitizeExportHtml(html);
}
