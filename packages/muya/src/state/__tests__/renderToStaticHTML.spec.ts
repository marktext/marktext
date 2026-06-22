// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { renderToStaticHTML } from '../renderToStaticHTML';

// `renderToStaticHTML` is the synchronous markdown -> HTML public API used by
// the CommonMark / GFM spec runners. It must:
//   1. Return a string synchronously (no async; spec runner uses `it.each`).
//   2. Sanitize via DOMPurify so XSS payloads are stripped (default;
//      `sanitize: false` bypasses for the spec runners).
//   3. Render mermaid / vega-lite / plantuml code blocks as inert
//      `<pre><code class="language-*">…</code></pre>` (i.e. plain fenced
//      code output — the same shape as before MarkdownToHtml's async
//      `renderMermaid` / `renderDiagram` step rewrites them). The
//      synchronous renderer never invokes those async rewriters.
//   4. Forward the same per-render option surface as `getHighlightHtml` —
//      see `option surface` describe block below for explicit coverage of
//      each option (footnote, math, superSubScript,
//      isGitlabCompatibilityEnabled, frontMatter).
//
// `MarkdownToHtml` (the existing class) already produces wrapped HTML, but its
// `renderHtml()` path is async (awaits mermaid + diagram renderers) and wraps
// the result in `<article class="markdown-body">`. Spec runners need the bare
// inner HTML; hence a separate, sync API.

describe('renderToStaticHTML', () => {
    it('renders a simple paragraph synchronously', () => {
        const html = renderToStaticHTML('Hello, world!');
        expect(html).toContain('<p>Hello, world!</p>');
    });

    it('renders headings with id-less <hN>', () => {
        const html = renderToStaticHTML('# Heading 1\n\n## Heading 2');
        expect(html).toContain('<h1>Heading 1</h1>');
        expect(html).toContain('<h2>Heading 2</h2>');
    });

    it('renders bullet and ordered lists', () => {
        const bullet = renderToStaticHTML('- a\n- b');
        expect(bullet).toContain('<ul>');
        expect(bullet).toContain('<li>a</li>');
        expect(bullet).toContain('<li>b</li>');

        const ordered = renderToStaticHTML('1. one\n2. two');
        expect(ordered).toContain('<ol>');
        expect(ordered).toContain('<li>one</li>');
        expect(ordered).toContain('<li>two</li>');
    });

    it('renders fenced code blocks with language class', () => {
        const html = renderToStaticHTML('```js\nconsole.log(1);\n```');
        expect(html).toContain('<pre>');
        expect(html).toContain('language-js');
        expect(html).toContain('console');
    });

    it('renders mermaid code blocks as inert <pre><code> placeholders', () => {
        const html = renderToStaticHTML(
            '```mermaid\ngraph LR; A-->B\n```',
        );
        // Mermaid renderer must not be invoked synchronously; the output
        // should remain a static `<pre><code class="language-mermaid">` with
        // the mermaid source as plain text (escaped, not parsed as HTML).
        expect(html).toMatch(/class="[^"]*language-mermaid[^"]*"/);
        expect(html).toContain('graph LR');
        // Sanity: the dangerous angle brackets in the source are escaped.
        expect(html).not.toContain('<graph');
        // No mermaid SVG must appear (renderer not invoked).
        expect(html).not.toMatch(/<svg[^>]*aria-roledescription="flowchart/);
    });

    it('renders vega-lite and plantuml code blocks as inert placeholders', () => {
        const vega = renderToStaticHTML(
            '```vega-lite\n{"mark":"bar"}\n```',
        );
        expect(vega).toMatch(/class="[^"]*language-vega-lite[^"]*"/);

        const puml = renderToStaticHTML(
            '```plantuml\n@startuml\nA -> B\n@enduml\n```',
        );
        expect(puml).toMatch(/class="[^"]*language-plantuml[^"]*"/);
    });

    it('strips inline event-handler attributes via DOMPurify', () => {
        const html = renderToStaticHTML(
            '<a href="x" onclick="alert(1)">x</a>',
        );
        expect(html).not.toContain('onclick');
        expect(html).not.toContain('alert(1)');
    });

    it('strips <script> tags via DOMPurify', () => {
        const html = renderToStaticHTML(
            'before\n\n<script>alert(1)</script>\n\nafter',
        );
        expect(html).not.toMatch(/<script/i);
        expect(html).toContain('before');
        expect(html).toContain('after');
    });

    it('returns the bare body HTML (no <article> wrapper)', () => {
        // `MarkdownToHtml.renderHtml` wraps the output in
        // `<article class="markdown-body">`; renderToStaticHTML must NOT,
        // because the spec runner compares raw block-level HTML.
        const html = renderToStaticHTML('paragraph');
        expect(html).not.toMatch(/<article[^>]*class="markdown-body"/);
    });

    describe('option surface', () => {
        it('honours superSubScript (on by default, off when superSubScript=false)', () => {
            const on = renderToStaticHTML('H~2~O and 2^n^');
            // superSubScript extension emits `<sub>` and `<sup>` wrappers.
            expect(on).toMatch(/<sub>2<\/sub>/);
            expect(on).toMatch(/<sup>n<\/sup>/);

            const off = renderToStaticHTML('H~2~O and 2^n^', { superSubScript: false });
            expect(off).not.toMatch(/<sub>/);
            expect(off).not.toMatch(/<sup>/);
        });

        // marktext b8e2cd82 "Fix inline html renderer" added a
        // `textRenderer.script` method so sup/sub markdown survives the
        // *HTML output* path (not just the editor render path). The new
        // muya repo's `superSubscript.ts` extension wires the renderer
        // directly (`renderer(token) { return '<sup>...</sup>' | '<sub>...</sub>' }`),
        // so both inline rendering and HTML export go through the same
        // emitter — there is no separate text-renderer to keep in sync.
        // These tests lock that behaviour for HTML output specifically.
        it('emits <sup>/<sub> wrappers when mixed with surrounding text (b8e2cd82 defensive)', () => {
            // The sup START regex (`SUP_START_REG`) requires a non-space
            // char (or BOL) before `^`; sub requires the opposite. The
            // realistic case is mid-paragraph use, which both forms
            // support side-by-side.
            const html = renderToStaticHTML('water H~2~O and exp 2^n^ done');
            expect(html).toMatch(/<sub>2<\/sub>/);
            expect(html).toMatch(/<sup>n<\/sup>/);
            // Both wrappers must coexist in the same <p>.
            expect(html).toMatch(/<p>[^<]*H<sub>2<\/sub>O[^<]*2<sup>n<\/sup>[^<]*<\/p>/);
        });

        it('emits <sup>/<sub> wrappers inside list items and headings (b8e2cd82 defensive)', () => {
            const html = renderToStaticHTML('# title H~2~O text\n\n- exp 2^n^ items');
            // sup/sub must survive nesting in block contexts, mirroring
            // marktext b8e2cd82's intent (any inline context, not just
            // bare paragraphs).
            expect(html).toMatch(/<h1>[^<]*H<sub>2<\/sub>O[^<]*<\/h1>/);
            expect(html).toMatch(/<li>[^<]*2<sup>n<\/sup>[^<]*<\/li>/);
        });

        it('honours isGitlabCompatibilityEnabled (promotes ```math fences to math blocks)', () => {
            // GitLab-flavoured Markdown lets a fenced code block tagged
            // ` ```math ` render as block math. `walkTokens` rewrites the
            // code-block token to `multiplemath` only when both
            // `math: true` AND `isGitlabCompatibilityEnabled: true`.
            const src = '```math\nx^2\n```';

            const gitlab = renderToStaticHTML(src, {
                math: true,
                isGitlabCompatibilityEnabled: true,
            });
            // multiplemath → KaTeX wrapper.
            expect(gitlab).toMatch(/katex|<math/i);

            const strict = renderToStaticHTML(src, {
                math: true,
                isGitlabCompatibilityEnabled: false,
            });
            // Without GitLab compatibility, the block stays a plain code
            // fence with language `math` — no KaTeX.
            expect(strict).not.toMatch(/katex|<math/i);
            expect(strict).toMatch(/<pre><code[^>]*>x\^2/);
        });

        it('honours frontMatter option (renders YAML front matter when enabled)', () => {
            const src = '---\ntitle: Hello\n---\n\n# Body';
            const off = renderToStaticHTML(src);
            // Default `frontMatter: false`: the `---` fence is treated as
            // an hr / setext heading by marked.
            expect(off).not.toMatch(/front-matter|frontmatter/i);

            const on = renderToStaticHTML(src, { frontMatter: true });
            // With frontMatter enabled, the YAML block is consumed by the
            // front-matter renderer and removed from the body output.
            expect(on).toMatch(/front-matter|frontmatter/i);
            // The Markdown body that follows is still rendered.
            expect(on).toContain('<h1>Body</h1>');
        });

        it('honours footnote option (off by default)', () => {
            const off = renderToStaticHTML(
                'See [^1].\n\n[^1]: footnote body',
            );
            // With footnote disabled the definition is parsed as a regular
            // paragraph / link-reference and the inline `[^1]` stays literal.
            // No backref section.
            expect(off).not.toMatch(/<section class="footnotes">/);
            expect(off).not.toMatch(/class="footnote-ref"/);

            // With footnote enabled PR-8c post-processes the marked extension
            // output into the GFM/pandoc shape: numbered `<sup>` inline +
            // bottom `<section class="footnotes">` with backref arrows. The
            // raw `<div class="footnote-block">` wrapper is lifted away.
            const on = renderToStaticHTML(
                'See [^1].\n\n[^1]: footnote body',
                { footnote: true },
            );
            expect(on).toMatch(/<sup class="footnote-ref"><a href="#fn-1" id="fnref-1">1<\/a><\/sup>/);
            expect(on).toMatch(/<section class="footnotes">[\s\S]*<\/section>/);
            expect(on).toMatch(/<li id="fn-1">/);
            expect(on).toMatch(/<a href="#fnref-1" class="footnote-backref">/);
            expect(on).toContain('footnote body');
            // The intermediate `<div class="footnote-block">` is hoisted into
            // the section and must not survive in the rendered body.
            expect(on).not.toMatch(/<div class="footnote-block"/);
        });

        it('honours math option', () => {
            const html = renderToStaticHTML('$$\nx^2\n$$', { math: true });
            // Math block should be transformed away from a literal `$$` fence.
            // KaTeX output contains class="katex" wrappers when math enabled.
            expect(html).toMatch(/katex|<math/i);
        });
    });

    it('returns a string for empty input', () => {
        expect(renderToStaticHTML('')).toBe('');
    });

    describe('sanitize option', () => {
        // Default (`sanitize: true`) is exercised by every other test above.
        // The `sanitize: false` mode exists so CommonMark / GFM spec runners
        // can compare against the parser's raw output without DOMPurify
        // rewriting examples that intentionally test "raw HTML allowance"
        // (e.g. CommonMark §6.9 `<a><bab><c2c>` — spec expects the unknown
        // `<bab>` preserved verbatim; DOMPurify would strip it).
        //
        // `sanitize: false` MUST NEVER be exposed to user-supplied markdown
        // in production: it drops the XSS guarantees of `MarkdownToHtml`.

        it('preserves arbitrary raw HTML tags when sanitize=false', () => {
            const html = renderToStaticHTML('<a><bab><c2c>', { sanitize: false });
            expect(html).toContain('<bab>');
            expect(html).toContain('<c2c>');
        });

        it('does NOT strip <script> when sanitize=false', () => {
            const html = renderToStaticHTML(
                '<script>alert(1)</script>',
                { sanitize: false },
            );
            // marked emits raw HTML blocks as-is — the danger is exactly the
            // point of this mode, hence the docstring warning.
            expect(html).toMatch(/<script>/);
        });

        it('still strips <script> when sanitize=true (default)', () => {
            const html = renderToStaticHTML(
                '<script>alert(1)</script>',
                { sanitize: true },
            );
            expect(html).not.toMatch(/<script/i);
        });
    });
});
