import type { Muya } from '../../../muya';
import type { IFrontmatterPropertyState, IFrontmatterState } from '../../../state/types';
import type { TBlockPath } from '../../types';
import type FrontmatterRow from './row';
import { mixins } from '../../../utils';
import { LinkedList } from '../../base/linkedList/linkedList';
import Parent from '../../base/parent';
import IContainerQueryBlock from '../../mixins/containerQueryBlock';
import { ScrollPage } from '../../scrollPage';

@mixins(IContainerQueryBlock)
class FrontmatterBody extends Parent {
    override children: LinkedList<FrontmatterRow> = new LinkedList();

    static override blockName = 'frontmatter.body';

    static create(muya: Muya, state: IFrontmatterState) {
        const body = new FrontmatterBody(muya);

        body.append(
            ...state.properties.map(prop =>
                ScrollPage.loadBlock('frontmatter.row').create(muya, prop),
            ),
        );

        return body;
    }

    override get path(): TBlockPath {
        return [...this.parent!.path, 'properties'];
    }

    constructor(muya: Muya) {
        super(muya);
        this.tagName = 'div';
        this.classList = ['mu-frontmatter-body'];
        this.createDomNode();
    }

    override getState(): IFrontmatterState {
        // Should not be called directly — Frontmatter.getState() reads from this.
        return {
            name: 'frontmatter',
            meta: { lang: 'yaml', style: '-' },
            properties: this.map(row => (row as FrontmatterRow).getState()) as IFrontmatterPropertyState[],
        };
    }
}

export default FrontmatterBody;
