import type { Muya } from '../muya';
import exportStyle from '../assets/styles/exportStyle.css?inline';
import { EXPORT_DOMPURIFY_CONFIG } from '../config';
import { isHTMLElement, sanitize, unescapeHTML } from '../utils';
import loadRenderer from '../utils/diagram';

import { getHighlightHtml } from '../utils/marked';

export class MarkdownToHtml {
    private _exportContainer: HTMLDivElement | null = null;

    constructor(public markdown: string, public muya?: Muya) {}

    async renderMermaid() {
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
        const mermaid = await loadRenderer('mermaid');
        // We only export light theme, so set mermaid theme to `default`, in the future, we can choose which theme to export.
        mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            theme: 'default',
        });
        await mermaid.run({
            nodes: [...this._exportContainer!.querySelectorAll('div.mermaid')],
        });
        if (this.muya) {
            mermaid.initialize({
                securityLevel: 'strict',
                theme: this.muya.options.mermaidTheme,
            });
        }
    }

    async renderDiagram() {
        const selector
            = 'code.language-vega-lite, code.language-plantuml';
        const codes = this._exportContainer!.querySelectorAll(selector);

        for (const code of codes) {
            const rawCode = unescapeHTML(code.innerHTML);
            const functionType = (() => {
                if (/plantuml/.test(code.className))
                    return 'plantuml';
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
                });
            }

            try {
                if (functionType === 'plantuml') {
                    const diagram = render.parse(rawCode);
                    diagramContainer.innerHTML = '';
                    diagram.insertImgElement(diagramContainer);
                }
                if (functionType === 'vega-lite')
                    await render(diagramContainer, JSON.parse(rawCode), options);
            }
            catch {
                diagramContainer.innerHTML = '< Invalid Diagram >';
            }
        }
    }

    // render pure html by marked
    async renderHtml() {
        let html = getHighlightHtml(this.markdown, {
            superSubScript: this.muya?.options?.superSubScript ?? true,
            footnote: this.muya?.options?.footnote ?? false,
            isGitlabCompatibilityEnabled:
        this.muya?.options?.isGitlabCompatibilityEnabled ?? true,
            math: this.muya?.options?.math ?? true,
        });

        html = sanitize(html, EXPORT_DOMPURIFY_CONFIG, false) as string;

        const exportContainer = (this._exportContainer
            = document.createElement('div'));
        exportContainer.classList.add('mu-render-container');
        exportContainer.innerHTML = html;
        document.body.appendChild(exportContainer);

        // render only render the light theme of mermaid and diagram...
        await this.renderMermaid();
        await this.renderDiagram();
        let result = exportContainer.innerHTML;
        exportContainer.remove();

        // hack to add arrow marker to output html
        // TODO: JOCS, are these codes still needed?
        const paths = document.querySelectorAll('path[id^=raphael-marker-]');
        const def = '<defs style="-webkit-tap-highlight-color: rgba(0, 0, 0, 0);">';
        result = result.replace(def, () => {
            let str = '';
            for (const path of paths)
                str += path.outerHTML;

            return `${def}${str}`;
        });

        this._exportContainer = null;

        return `<article class="markdown-body">${result}</article>`;
    }

    /**
     * Get HTML with style
     *
     * @param {*} options Document options
     */
    async generate(options: { title?: string; extraCSS?: string } = {}) {
        const html = await this.renderHtml();

        // `extraCSS` may changed in the mean time.
        const { title = '', extraCSS = '' } = options;
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${sanitize(title, EXPORT_DOMPURIFY_CONFIG, true)}</title>
  <!-- https://cdnjs.com/libraries/github-markdown-css -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown-light.css" integrity="sha512-n5zPz6LZB0QV1eraRj4OOxRbsV7a12eAGfFcrJ4bBFxxAwwYDp542z5M0w24tKPEhKk2QzjjIpR5hpOjJtGGoA==" crossorigin="anonymous" referrerpolicy="no-referrer" />
  <!-- https://katex.org/docs/browser -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css" integrity="sha384-GvrOXuhMATgEsSwCs4smul74iXGOixntILdUW9XmUC6+HX0sLNAK3q71HotJqlAn" crossorigin="anonymous">
  <!-- https://cdnjs.com/libraries/prism -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/9000.0.1/themes/prism.min.css" integrity="sha512-/mZ1FHPkg6EKcxo0fKXF51ak6Cr2ocgDi5ytaTBjsQZIH/RNs6GF6+oId/vPe3eJB836T36nXwVh/WBl/cWT4w==" crossorigin="anonymous" referrerpolicy="no-referrer" />
  <style>${exportStyle}</style>
  <style>${extraCSS}</style>
</head>
<body>
  ${html}
</body>
</html>`;
    }
}
