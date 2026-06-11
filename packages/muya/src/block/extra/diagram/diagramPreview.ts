import type { Muya } from '../../../muya';
import type { IDiagramState, TState } from '../../../state/types';
import { fromEvent } from 'rxjs';
import { CLASS_NAMES, PREVIEW_DOMPURIFY_CONFIG } from '../../../config';
import { sanitize } from '../../../utils';
import loadRenderer from '../../../utils/diagram';
import logger from '../../../utils/logger';
import Parent from '../../base/parent';

const debug = logger('diagramPreview:');

interface IRenderOptions {
    type: string;
    code: string;
    target: HTMLElement;
    vegaTheme: string;
    mermaidTheme: string;
    sequenceTheme: 'hand' | 'simple';
}

async function renderDiagram({
    type,
    code,
    target,
    vegaTheme,
    mermaidTheme,
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
        });
    }
    else if (type === 'sequence') {
        Object.assign(options, { theme: sequenceTheme });
    }

    if (type === 'plantuml') {
        const diagram = render.parse(code);
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
        target.innerHTML = sanitize(code, PREVIEW_DOMPURIFY_CONFIG, true) as string;
        target.removeAttribute('data-processed');
        await render.run({
            nodes: [target],
        });
    }
}

class DiagramPreview extends Parent {
    public code: string;
    public type: string;
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
        this.code = text;
        this.type = meta.type;
        this.classList = ['mu-diagram-preview'];
        this.attributes = {
            spellcheck: 'false',
            contenteditable: 'false',
        };
        this.createDomNode();
        this.attachDOMEvents();
        this.update();
    }

    override getState(): TState {
        debug.warn('You can never call `getState` in diagramPreview');
        return {} as TState;
    }

    attachDOMEvents() {
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

    async update(code = this.code) {
        const { i18n } = this.muya;
        if (this.code !== code)
            this.code = code;

        if (code) {
            this.domNode!.innerHTML = i18n.t('Loading...');
            const { mermaidTheme, vegaTheme, sequenceTheme } = this.muya.options;
            const { type } = this;

            try {
                await renderDiagram({
                    target: this.domNode!,
                    code,
                    type,
                    mermaidTheme,
                    vegaTheme,
                    sequenceTheme,
                });
            }
            catch {
                this.domNode!.innerHTML = `<div class="mu-diagram-error">&lt; ${i18n.t(
                    'Invalid Diagram Code',
                )} &gt;</div>`;
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
