import { expect, test } from '../fixtures/muya';

/**
 * Public `MarkdownToHtml` static-export class. Host exposes it on
 * `window.MarkdownToHtml`. The class returns a full
 * `<!DOCTYPE html>…</html>` document from `generate()` with the rendered
 * markdown body wrapped in `<article class="markdown-body">`. Sanitisation
 * is handled by DOMPurify inside `renderHtml`.
 *
 * Sanity check: this is the SAME pipeline that ships to consumers, so
 * we want to verify it for shape AND for XSS safety.
 */

const SAMPLE_MARKDOWN = `# Heading

- one
- two
- three

\`\`\`js
const x = 1;
\`\`\`

$$a \\ne b$$
`;

test.describe('export / MarkdownToHtml', () => {
    test('window.MarkdownToHtml is exposed by the host', async ({ page }) => {
        const isClass = await page.evaluate(() => typeof window.MarkdownToHtml === 'function');
        expect(isClass).toBe(true);
    });

    test('generate() emits heading, list, code-block, and KaTeX markup', async ({ page }) => {
        const html = await page.evaluate(async (md) => {
            // Cast away the optional — the previous test asserts presence.
            const instance = new window.MarkdownToHtml!(md);
            return instance.generate();
        }, SAMPLE_MARKDOWN);

        expect(html).toMatch(/<!DOCTYPE html>/i);
        // Body markup is wrapped in <article class="markdown-body">
        expect(html).toContain('<article class="markdown-body">');
        // Heading rendered.
        expect(html).toMatch(/<h1[^>]*>\s*Heading\s*<\/h1>/);
        // Unordered list rendered (three list items).
        expect(html).toContain('<ul>');
        expect(html).toContain('one');
        expect(html).toContain('two');
        expect(html).toContain('three');
        // Fenced code-block rendered as <pre><code>.
        expect(html).toMatch(/<pre><code[^>]*>/);
        // KaTeX math rendering produces a katex span class on the math
        // node. We assert on the substring rather than parsing, since
        // KaTeX HTML structure is intricate.
        expect(html).toContain('katex');
    });

    test('mermaid diagram input renders a mermaid container', async ({ page }) => {
        // A fenced code block with `mermaid` language is the standard
        // mermaid input shape. MarkdownToHtml::renderMermaid promotes
        // it to a `<div class="mermaid">` post-process, then runs the
        // mermaid renderer over it.
        const mermaidMd = `\`\`\`mermaid\ngraph TD; A-->B;\n\`\`\`\n`;
        const html = await page.evaluate(async (md) => {
            const instance = new window.MarkdownToHtml!(md);
            return instance.generate();
        }, mermaidMd);

        // After mermaid.run, the container either holds an SVG or the
        // original .mermaid div (when the renderer no-ops on parse
        // failure). Either way the class survives the pipeline.
        expect(html).toMatch(/class="mermaid"|<svg/);
    });

    test('script injection: <script> tag is sanitised away and does not execute', async ({ page }) => {
        // Crucial XSS guarantee. The markdown payload below would, if
        // unsanitised, cause `window.__exported = true` on the host
        // page (we don't insert the output into the DOM, but a script
        // could still execute via inline event handlers).
        const xssMd = `# Hello\n\nbefore <script>(window).__exported = true;<\/script> after\n`;

        // Clear the sentinel first.
        await page.evaluate(() => {
            (window as Window & { __exported?: boolean }).__exported = false;
        });

        const html = await page.evaluate(async (md) => {
            const instance = new window.MarkdownToHtml!(md);
            return instance.generate();
        }, xssMd);

        // No `<script>` in the output (case-insensitive — DOMPurify
        // returns lowercase tag names but the original could be mixed).
        expect(html.toLowerCase()).not.toContain('<script');

        // Insert the output's <article> body into a sandboxed div in the
        // host page and confirm no script side-effect. Pulls just the
        // <article>...</article> chunk to skip the <head><script> link
        // tags MarkdownToHtml wraps around the body.
        const sideEffect = await page.evaluate((generated) => {
            const articleMatch = generated.match(/<article[\s\S]*?<\/article>/i);
            if (!articleMatch)
                return { mounted: false, exported: undefined as boolean | undefined };
            const wrapper = document.createElement('div');
            wrapper.style.display = 'none';
            wrapper.innerHTML = articleMatch[0];
            document.body.appendChild(wrapper);
            const exported = (window as Window & { __exported?: boolean }).__exported;
            wrapper.remove();
            return { mounted: true, exported };
        }, html);

        expect(sideEffect.mounted).toBe(true);
        // The original payload should not have flipped the sentinel.
        expect(sideEffect.exported).toBe(false);
    });
});
