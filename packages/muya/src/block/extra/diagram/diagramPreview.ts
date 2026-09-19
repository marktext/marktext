import type { Muya } from '../../../muya';
import type { IDiagramState, TState } from '../../../state/types';
import { fromEvent } from 'rxjs';
import { CLASS_NAMES, PREVIEW_DOMPURIFY_CONFIG } from '../../../config';
import { sanitize } from '../../../utils';
import loadRenderer from '../../../utils/diagram';
import logger from '../../../utils/logger';
import Parent from '../../base/parent';

const debug = logger('diagramPreview:');

// Mermaid's own `run()` derives the id it stamps on the rendered `<svg>` from
// `Date.now()`, and its renderers then resolve that id with a document-wide
// lookup. Two diagrams whose renders begin in the same millisecond therefore
// draw into a single element: the first block shows both diagrams on top of
// each other, the second stays empty (#5023). Mint the id here instead —
// `render()` takes one — so concurrent renders can never share it.
let mermaidRenderCount = 0;

// Give a fixed-size `<svg>` (one with `width`/`height` px attributes but no
// `viewBox`) a viewBox derived from those dimensions, so `max-width: 100%`
// scales it down to fit instead of clipping it. Returns true once applied.
function addViewBox(target: HTMLElement): boolean {
    const svg = target.querySelector('svg');
    if (!svg || svg.getAttribute('viewBox'))
        return !!svg;
    const width = Number.parseFloat(svg.getAttribute('width') ?? '');
    const height = Number.parseFloat(svg.getAttribute('height') ?? '');
    if (width > 0 && height > 0) {
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        return true;
    }
    return false;
}

// `drawSVG` (js-sequence-diagrams / flowchart.js) renders the `<svg>`
// asynchronously — it's drawn from a theme callback after its font loads — so
// the element and its `width`/`height` attributes aren't there synchronously.
// Try once, then observe `target` until the sized `<svg>` appears.
function ensureViewBox(target: HTMLElement): void {
    if (addViewBox(target))
        return;
    const observer = new MutationObserver(() => {
        if (addViewBox(target))
            observer.disconnect();
    });
    observer.observe(target, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['width', 'height'],
    });
    // Safety net so the observer can't leak if the svg never renders.
    setTimeout(() => observer.disconnect(), 5000);
}

interface IRenderOptions {
    type: string;
    code: string;
    target: HTMLElement;
    vegaTheme: string;
    mermaidTheme: string;
    plantumlServer: string;
    sequenceTheme: 'hand' | 'simple';
}

async function renderDiagram({
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
        // js-sequence-diagrams / flowchart.js emit an <svg> with a fixed pixel
        // width/height but NO viewBox, so the `max-width: 100%` style can only
        // clip a wide diagram, not scale it. Derive a viewBox from those pixel
        // dimensions (once the async draw completes) so it scales to fit.
        ensureViewBox(target);
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

class DiagramPreview extends Parent {
    private _code: string;
    private _type: string;
    static override blockName = 'diagram-preview';

    static create(muya: Muya, state: IDiagramState) {
        const diagramPreview = new DiagramPreview(muya, state);

        return diagramPreview;
    }

    override get path() {
        debug.warn('You can never call `get path` in diagramPreview');
        return [];
    }

    constructor(muya: Muya, { text, meta }: IDiagramState) {
        super(muya);
        this.tagName = 'div';
        this._code = text;
        this._type = meta.type;
        this.classList = ['mu-diagram-preview'];
        this.attributes = {
            spellcheck: 'false',
            contenteditable: 'false',
        };
        this.createDomNode();
        this._attachDOMEvents();
        this.update();
    }

    override getState(): TState {
        debug.warn('You can never call `getState` in diagramPreview');
        return {} as TState;
    }

    private _attachDOMEvents() {
        const clickObservable = fromEvent(this.domNode!, 'click');
        clickObservable.subscribe(this.clickHandler.bind(this));
    }

    clickHandler(event: Event) {
        event.preventDefault();
        event.stopPropagation();

        if (this.parent == null)
            return;

        const cursorBlock = this.parent.firstContentInDescendant();
        cursorBlock?.setCursor(0, 0);
    }

    async update(code = this._code) {
        const { i18n } = this.muya;
        if (this._code !== code)
            this._code = code;

        if (code) {
            this.domNode!.innerHTML = i18n.t('Loading...');
            const { mermaidTheme, vegaTheme, plantumlServer, sequenceTheme } = this.muya.options;
            const { _type: type } = this;

            try {
                await renderDiagram({
                    target: this.domNode!,
                    code,
                    type,
                    mermaidTheme,
                    vegaTheme,
                    plantumlServer,
                    sequenceTheme,
                });
            }
            catch (error) {
                const detail
                    = error instanceof Error ? error.message : String(error);
                debug.error(`render ${type} diagram failed: ${detail}`);
                this.domNode!.innerHTML = `<div class="mu-diagram-error">&lt; ${i18n.t(
                    'Invalid Diagram Code',
                )} &gt;<div class="mu-diagram-error-detail">${sanitize(
                    detail,
                    PREVIEW_DOMPURIFY_CONFIG,
                    true,
                )}</div></div>`;
            }
        }
        else {
            this.domNode!.innerHTML = `<div class="${CLASS_NAMES.MU_EMPTY}">&lt; ${i18n.t(
                'Empty Diagram',
            )} &gt;</div>`;
        }
    }
}

export default DiagramPreview;
