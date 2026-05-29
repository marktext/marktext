import type { Muya } from '../../../muya';
import type { IHtmlBlockState, TState } from '../../../state/types';
import logger from '../../../utils/logger';
import Parent from '../../base/parent';
import { ScrollPage } from '../../scrollPage';

const debug = logger('htmlContainer:');

class HTMLContainer extends Parent {
    static override blockName = 'html-container';

    static create(muya: Muya, state: IHtmlBlockState) {
        const htmlContainer = new HTMLContainer(muya);

        const code = ScrollPage.loadBlock('code').create(muya, state);

        htmlContainer.append(code);

        return htmlContainer;
    }

    get lang() {
        return 'markup';
    }

    override get path() {
        const { path: pPath } = this.parent!;

        return [...pPath];
    }

    constructor(muya: Muya) {
        super(muya);
        this.tagName = 'pre';
        this.classList = ['mu-html-container'];
        this.createDomNode();
    }

    override getState(): TState {
        debug.warn('You can never call `getState` in htmlContainer');
        return {} as TState;
    }
}

export default HTMLContainer;
