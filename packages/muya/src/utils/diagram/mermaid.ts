import type { Mermaid, MermaidConfig } from 'mermaid';
import loadRenderer from './index';

let renderCount = 0;
let renderQueue: Promise<void> = Promise.resolve();

interface IMermaidRenderOptions {
    target: HTMLElement;
    theme: string;
    code?: string;
}

// Each diagram owns the shared configuration until rendering and binding finish.
// Omit code to preserve Mermaid.run's HTML/entity handling for export nodes.
export function renderMermaid({ target, theme, code }: IMermaidRenderOptions): Promise<void> {
    const result = renderQueue.then(async () => {
        const mermaid: Mermaid = await loadRenderer('mermaid');
        mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            // Muya accepts theme strings; Mermaid falls back for unrecognized names.
            theme: theme as MermaidConfig['theme'],
        });

        if (code === undefined) {
            await mermaid.run({ nodes: [target] });
            return;
        }

        await mermaid.parse(code);
        // Same-millisecond previews must not share Mermaid's document-wide SVG IDs (#5023).
        const { svg, bindFunctions } = await mermaid.render(
            `mu-mermaid-${++renderCount}`,
            code,
            target,
        );
        target.innerHTML = svg;
        bindFunctions?.(target);
    });
    renderQueue = result.catch(() => {});
    return result;
}
