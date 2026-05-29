import type { Muya } from '../../../muya';
import type { IListItemState } from '../../../state/types';
import { mixins } from '../../../utils';
import { LinkedList } from '../../base/linkedList/linkedList';
import Parent from '../../base/parent';
import IContainerQueryBlock from '../../mixins/containerQueryBlock';
import { ScrollPage } from '../../scrollPage';

@mixins(IContainerQueryBlock)
class ListItem extends Parent {
    public override children: LinkedList<Parent> = new LinkedList();

    static override blockName = 'list-item';

    static create(muya: Muya, state: IListItemState) {
        const listItem = new ListItem(muya);

        listItem.append(
            ...state.children.map(child =>
                ScrollPage.loadBlock(child.name).create(muya, child),
            ),
        );

        return listItem;
    }

    override get path() {
        const { path: pPath } = this.parent!;
        const offset = this.parent!.offset(this);

        return [...pPath, offset, 'children'];
    }

    constructor(muya: Muya) {
        super(muya);
        this.tagName = 'li';
        this.classList = ['mu-list-item'];
        this.createDomNode();
    }

    override getState(): IListItemState {
        const state: IListItemState = {
            name: 'list-item',
            children: this.children.map(child => child.getState()),
        };

        return state;
    }
}

export default ListItem;
