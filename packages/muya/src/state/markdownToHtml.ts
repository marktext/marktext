import type { Muya } from '../muya';
import type { IMuyaOptions } from '../types';
import githubMarkdownCss from 'github-markdown-css/github-markdown-light.css?inline';
import katexCss from 'katex/dist/katex.css?inline';
import prismCss from 'prismjs/themes/prism.css?inline';
import exportStyle from '../assets/styles/exportStyle.css?inline';
import { EXPORT_DOMPURIFY_CONFIG } from '../config';
import { isHTMLElement, sanitize, unescapeHTML } from '../utils';
import loadRenderer from '../utils/diagram';

import { getHighlightHtml } from '../utils/marked';
import { sanitizeExportHtml } from '../utils/sanitizeExportHtml';
import { generateGithubSlug } from '../utils/slug';
import { transformFootnotes } from './transformFootnotes';

// Inline core styles so exported documents render offline.

const CDN_STYLESHEET_LINKS = `  <!-- https://cdnjs.com/libraries/github-markdown-css -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown-light.css" integrity="sha512-n5zPz6LZB0QV1eraRj4OOxRbsV7a12eAGfFcrJ4bBFxxAwwYDp542z5M0w24tKPEhKk2QzjjIpR5hpOjJtGGoA==" crossorigin="anonymous" referrerpolicy="no-referrer" />
  <!-- https://katex.org/docs/browser -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css" integrity="sha384-GvrOXuhMATgEsSwCs4smul74iXGOixntILdUW9XmUC6+HX0sLNAK3q71HotJqlAn" crossorigin="anonymous">
  <!-- https://cdnjs.com/libraries/prism -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/9000.0.1/themes/prism.min.css" integrity="sha512-/mZ1FHPkg6EKcxo0fKXF51ak6Cr2ocgDi5ytaTBjsQZIH/RNs6GF6+oId/vPe3eJB836T36nXwVh/WBl/cWT4w==" crossorigin="anonymous" referrerpolicy="no-referrer" />`;

// Place after exportStyle to override paragraph and tight-list soft-break whitespace.
const SOFT_NEWLINE_AS_SPACE_OVERRIDE = `
.markdown-body p,
.markdown-body li:not(:has(> p)) {
    white-space: normal;
}
`;

export class MarkdownToHtml {
    private _exportContainer: HTMLDivElement | null = null;

    constructor(public markdown: string, private _muya?: Muya) {}

    private async _renderMermaid() {
        const codes = this._exportContainer!.querySelectorAll(
            'code.language-mermaid',
        );
        for (const code of codes) {
            const preEle = code.parentNode;
            if (!isHTMLElement(preEle))
                continue;
            const mermaidContainer = document.createElement('div');
            mermaidContainer.innerHTML = sanitize(
                unescapeHTML(code.innerHTML),
                EXPORT_DOMPURIFY_CONFIG,
                true,
            ) as string;
            mermaidContainer.classList.add('mermaid');
            preEle.replaceWith(mermaidContainer);
        }
        const nodes = [...this._exportContainer!.querySelectorAll('div.mermaid')];
        if (nodes.length === 0)
            return;

        const mermaid = await loadRenderer('mermaid');
        // Export uses the light theme.
        mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            theme: 'default',
        });
        // Isolate renders so one invalid Mermaid diagram cannot abort the entire export (#4812).
        for (const node of nodes) {
            try {
                await mermaid.run({ nodes: [node] });
            }
            catch {
                node.innerHTML = '< Invalid Diagram >';
            }
        }
        if (this._muya) {
            mermaid.initialize({
                securityLevel: 'strict',
                theme: this._muya.options.mermaidTheme,
            });
        }
    }

    private async _renderDiagram() {
        const selector
            = 'code.language-vega-lite, code.language-plantuml, code.language-flowchart, code.language-sequence';
        const codes = this._exportContainer!.querySelectorAll(selector);

        for (const code of codes) {
            const rawCode = unescapeHTML(code.innerHTML);
            const functionType = (() => {
                if (/plantuml/.test(code.className))
                    return 'plantuml';
                else if (/flowchart/.test(code.className))
                    return 'flowchart';
                else if (/sequence/.test(code.className))
                    return 'sequence';
                else
                    return 'vega-lite';
            })();
            const render = await loadRenderer(functionType);
            const preParent = code.parentNode;
            if (!isHTMLElement(preParent))
                continue;
            const diagramContainer = document.createElement('div');
            diagramContainer.classList.add(functionType);
            preParent.replaceWith(diagramContainer);
            const options = {};
            if (functionType === 'vega-lite') {
                Object.assign(options, {
                    actions: false,
                    tooltip: false,
                    renderer: 'svg',
                    theme: 'latimes', // only render light theme
                    // Parse the spec to an AST and evaluate expressions with the
                    // interpreter instead of compiling them via `new Function`,
                    // which the sandboxed renderer's CSP blocks (`unsafe-eval`
                    // is not granted) — without this the embed throws and the
                    // chart renders as `< Invalid Diagram >`.
                    ast: true,
                });
            }
            else if (functionType === 'sequence') {
                Object.assign(options, {
                    theme: this._muya?.options.sequenceTheme ?? 'hand',
                });
            }

            try {
                if (functionType === 'plantuml') {
                    const diagram = render.parse(rawCode, this._muya?.options.plantumlServer);
                    diagramContainer.innerHTML = '';
                    diagram.insertImgElement(diagramContainer);
                }
                else if (functionType === 'flowchart' || functionType === 'sequence') {
                    const diagram = render.parse(rawCode);
                    diagramContainer.innerHTML = '';
                    diagram.drawSVG(diagramContainer, options);
                }
                else if (functionType === 'vega-lite') {
                    await render(diagramContainer, JSON.parse(rawCode), options);
                }
            }
            catch {
                diagramContainer.innerHTML = '< Invalid Diagram >';
            }
        }
    }

    // Generate unique GitHub-style heading IDs without replacing or colliding with explicit IDs.
    private _injectHeadingIds(container: HTMLElement) {
        const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
        const seen = new Set<string>();

        // Reserve any pre-existing ids first so generated slugs never collide
        // with them.
        for (const heading of headings) {
            if (heading.id)
                seen.add(heading.id);
        }

        for (const heading of headings) {
            if (heading.id)
                continue;

            const base = generateGithubSlug(heading.textContent ?? '') || 'heading';
            let slug = base;
            let n = 1;
            while (seen.has(slug))
                slug = `${base}-${n++}`;

            seen.add(slug);
            heading.id = slug;
        }
    }

    async renderHtml() {
        const options: Partial<IMuyaOptions> = this._muya?.options ?? {};
        const footnote = options.footnote ?? false;
        let html = getHighlightHtml(this.markdown, {
            superSubScript: options.superSubScript ?? true,
            footnote,
            texMathGfm: options.texMathGfm ?? false,
            texMathSingleBackslash: options.texMathSingleBackslash ?? false,
            texMathDoubleBackslash: options.texMathDoubleBackslash ?? false,
            texMathDollars: options.texMathDollars ?? true,
            highlightSyntax: options.highlightSyntax ?? false,
            inlineDiff: options.inlineDiff ?? false,
            multilineBlockquote: options.multilineBlockquote ?? false,
            githubAlerts: options.githubAlerts ?? false,
        });

        // Transform footnotes before DOMPurify strips their data-identifier markers.
        if (footnote)
            html = transformFootnotes(html);

        html = sanitizeExportHtml(html);

        const exportContainer = (this._exportContainer
            = document.createElement('div'));
        exportContainer.classList.add('mu-render-container');
        exportContainer.innerHTML = html;
        document.body.appendChild(exportContainer);

        let result: string;
        try {
            await this._renderMermaid();
            await this._renderDiagram();

            // Exported TOC links require matching heading IDs; spec conformance rendering omits this pass.
            this._injectHeadingIds(exportContainer);

            result = exportContainer.innerHTML;
        }
        finally {
            exportContainer.remove();
            this._exportContainer = null;
        }

        // Include Raphael arrow markers in exported diagrams.
        const paths = document.querySelectorAll('path[id^=raphael-marker-]');
        const def = '<defs style="-webkit-tap-highlight-color: rgba(0, 0, 0, 0);">';
        result = result.replace(def, () => {
            let str = '';
            for (const path of paths)
                str += path.outerHTML;

            return `${def}${str}`;
        });

        return `<article class="markdown-body">${result}</article>`;
    }

    /**
     * Get HTML with style.
     *
     * @param options Document options.
     * @param options.title Document `<title>`.
     * @param options.extraCSS Extra CSS appended after the base stylesheets.
     * @param options.inlineStyles Inline the core stylesheets so the output is
     * self-contained and renders offline (default `true`); pass `false` to fall
     * back to CDN `<link>` tags.
     * @param options.dir Text direction set on the root `<html>` (`rtl` / `auto`);
     * `ltr` is the HTML default and stays implicit.
     */
    async generate(
        options: {
            title?: string;
            extraCSS?: string;
            inlineStyles?: boolean;
            dir?: string;
        } = {},
    ) {
        const html = await this.renderHtml();
        const { embedExportFonts } = await import('../utils/embedExportFonts');

        const { title = '', extraCSS = '', inlineStyles = true, dir } = options;

        const exportStyleFinal = this._muya?.options.softNewlineAsSpace
            ? exportStyle + SOFT_NEWLINE_AS_SPACE_OVERRIDE
            : exportStyle;

        // Export outside the editor root, where its custom properties no longer inherit.
        const codeFontFamily = this._muya?.options.codeFontFamily || '';
        const codeFontCSS = codeFontFamily
            ? `.markdown-body{--mu-code-font-family:${codeFontFamily};}`
            : '';

        // Preserve RTL direction in exports; leave default LTR implicit (#4553).
        const dirAttr = dir === 'rtl' || dir === 'auto' ? ` dir="${dir}"` : '';

        let baseStyles: string;
        if (inlineStyles) {
            baseStyles = [githubMarkdownCss, embedExportFonts(katexCss), prismCss]
                .map(css => `  <style>${css}</style>`)
                .join('\n');
        }
        else {
            baseStyles = CDN_STYLESHEET_LINKS;
        }

        return `<!DOCTYPE html>
<html lang="en"${dirAttr}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${sanitize(title, EXPORT_DOMPURIFY_CONFIG, true)}</title>
${baseStyles}
  <style>${embedExportFonts(exportStyleFinal)}${codeFontCSS}</style>
  <style>${extraCSS}</style>
</head>
<body>
  ${html}
</body>
</html>`;
    }
}
