import loadRenderer from './index';

// Concurrent Mermaid renders can share Date.now()-based IDs; provide unique IDs
// to prevent diagrams drawing into the same element (#5023).
let mermaidRenderCount = 0;

const RAPHAEL_DESC = /^Created with Rapha/;

// Supply a viewBox for fixed-size SVGs so responsive sizing scales instead of clips.
// Return false until dimensions are available.
function sizeSvg(svg: Element): boolean {
    if (svg.getAttribute('viewBox'))
        return true;
    const width = Number.parseFloat(svg.getAttribute('width') ?? '');
    const height = Number.parseFloat(svg.getAttribute('height') ?? '');
    if (width > 0 && height > 0) {
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        return true;
    }
    return false;
}

function accessibleName(media: Element, fallback: string): string {
    if (media.tagName.toLowerCase() !== 'svg')
        return fallback;

    const explicit = media.getAttribute('aria-label');
    if (explicit)
        return explicit;

    let title = '';
    let desc = '';
    for (const child of Array.from(media.children)) {
        const tag = child.tagName.toLowerCase();
        if (tag === 'title' && !title)
            title = (child.textContent ?? '').trim();
        else if (tag === 'desc' && !desc)
            desc = (child.textContent ?? '').trim();
    }
    // flowchart.js draws through Raphael, which stamps its own <desc> on every diagram.
    if (RAPHAEL_DESC.test(desc))
        desc = '';

    return [title, desc].filter(Boolean).join('. ') || fallback;
}

function applyFinalizations(target: HTMLElement, fallback: string): boolean {
    const media = target.querySelector('svg, img');
    if (!media)
        return false;
    if (media.tagName.toLowerCase() === 'svg' && !sizeSvg(media))
        return false;

    target.setAttribute('role', 'img');
    target.setAttribute('aria-label', accessibleName(media, fallback));

    return true;
}

// drawSVG may finish after fonts load. Observe until the SVG and dimensions arrive.
export function finalizeRenderedDiagram(target: HTMLElement, fallbackLabel: string): () => void {
    if (applyFinalizations(target, fallbackLabel))
        return () => {};

    const observer = new MutationObserver(() => {
        if (applyFinalizations(target, fallbackLabel))
            observer.disconnect();
    });
    observer.observe(target, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['width', 'height'],
    });
    // Safety net so the observer can't leak if the diagram never renders.
    const timer = setTimeout(() => observer.disconnect(), 5000);

    // The render owner must cancel observation when its target is replaced.
    return () => {
        clearTimeout(timer);
        observer.disconnect();
    };
}

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n/;

// Use a per-render init directive; global Mermaid initialization would race live previews.
export function withMermaidInit(code: string, config: Record<string, unknown>): string {
    const directive = `%%{init: ${JSON.stringify(config)}}%%`;
    const frontmatter = FRONTMATTER.exec(code)?.[0] ?? '';
    const body = code.slice(frontmatter.length);

    return body.startsWith(directive)
        ? code
        : `${frontmatter}${directive}\n${body}`;
}

export interface IRenderOptions {
    type: string;
    code: string;
    target: HTMLElement;
    vegaTheme: string;
    mermaidTheme: string;
    plantumlServer: string;
    sequenceTheme: 'hand' | 'simple';
}

export interface IExportRenderOptions extends IRenderOptions {
    // Disable foreignObject labels for rasterization: Chromium drops them in SVG images.
    htmlLabels: boolean;
}

export async function renderDiagramForExport({
    htmlLabels,
    ...options
}: IExportRenderOptions): Promise<void> {
    const code = options.type === 'mermaid' && !htmlLabels
        ? withMermaidInit(options.code, { htmlLabels: false })
        : options.code;

    await renderDiagram({ ...options, code });
}

export async function renderDiagram({
    type,
    code,
    target,
    vegaTheme,
    mermaidTheme,
    plantumlServer,
    sequenceTheme,
}: IRenderOptions) {
    const render = await loadRenderer(type);
    const options = {};
    if (type === 'vega-lite') {
        Object.assign(options, {
            actions: false,
            tooltip: false,
            renderer: 'svg',
            theme: vegaTheme,
            ast: true,
        });
    }
    else if (type === 'sequence') {
        Object.assign(options, { theme: sequenceTheme });
    }

    if (type === 'plantuml') {
        const diagram = render.parse(code, plantumlServer);
        target.innerHTML = '';
        diagram.insertImgElement(target);
    }
    else if (type === 'vega-lite') {
        await render(target, JSON.parse(code), options);
    }
    else if (type === 'flowchart' || type === 'sequence') {
        const diagram = render.parse(code);
        target.innerHTML = '';
        diagram.drawSVG(target, options);
    }
    else if (type === 'mermaid') {
        render.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            theme: mermaidTheme,
        });
        await render.parse(code);
        const { svg, bindFunctions } = await render.render(
            `mu-mermaid-${++mermaidRenderCount}`,
            code,
            target,
        );
        target.innerHTML = svg;
        bindFunctions?.(target);
    }
}
