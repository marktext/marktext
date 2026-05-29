import type { Muya } from '../../../muya';
import type { IDiagramMeta, IDiagramState, TState } from '../../../state/types';
import logger from '../../../utils/logger';
import Parent from '../../base/parent';
import { ScrollPage } from '../../scrollPage';

const debug = logger('diagramContainer:');

class DiagramContainer extends Parent {
    public meta: IDiagramMeta;
    static override blockName = 'diagram-container';

    static create(muya: Muya, state: IDiagramState) {
        const diagramContainer = new DiagramContainer(muya, state);

        const code = ScrollPage.loadBlock('code').create(muya, state);

        diagramContainer.append(code);

        return diagramContainer;
    }

    get lang() {
        return this.meta.lang;
    }

    override get path() {
        const { path: pPath } = this.parent!;

        return [...pPath];
    }

    constructor(muya: Muya, { meta }: IDiagramState) {
        super(muya);
        this.tagName = 'pre';
        this.meta = meta;
        this.classList = ['mu-diagram-container'];
        this.createDomNode();
    }

    override getState(): TState {
        debug.warn('You can never call `getState` in diagramContainer');
        return {} as TState;
    }
}

export default DiagramContainer;
