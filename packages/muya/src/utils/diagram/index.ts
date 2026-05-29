const rendererCache = new Map();
/**
 *
 * @param {string} name the renderer name:plantuml, mermaid, vega-lite
 */
async function loadRenderer(name: string) {
    if (!rendererCache.has(name)) {
        let m;
        switch (name) {
            case 'plantuml':
                m = await import('./plantuml');
                rendererCache.set(name, m.default);
                break;

            case 'mermaid':
                m = await import('mermaid');
                rendererCache.set(name, m.default);
                break;

            case 'vega-lite':
                m = await import('vega-embed');
                rendererCache.set(name, m.default);
                break;

            default:
                throw new Error(`Unknown diagram name ${name}`);
        }
    }

    return rendererCache.get(name);
}

export default loadRenderer;
