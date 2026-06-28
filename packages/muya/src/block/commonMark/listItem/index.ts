import type { Muya } from '../../../muya';
import type { IListItemState } from '../../../state/types';
import { CLASS_NAMES } from '../../../config';
import { mixins } from '../../../utils';
import { LinkedList } from '../../base/linkedList/linkedList';
import Parent from '../../base/parent';
import IContainerQueryBlock from '../../mixins/containerQueryBlock';
import { ScrollPage } from '../../scrollPage';

@mixins(IContainerQueryBlock)
class ListItem extends Parent {
    public override children: LinkedList<Parent> = new LinkedList();
    public meta?: IListItemState['meta'];

    static override blockName = 'list-item';

    static create(muya: Muya, state: IListItemState) {
        const listItem = new ListItem(muya);
        listItem.meta = ListItem._cloneMeta(state.meta);

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
        this.classList = [CLASS_NAMES.MU_LIST_ITEM];
        this.createDomNode();
    }

    private static _cloneMeta(meta: IListItemState['meta']): IListItemState['meta'] {
        if (!meta)
            return undefined;

        return {
            ...meta,
        };
    }

    override getState(): IListItemState {
        const state: IListItemState = {
            name: 'list-item',
            ...(this.meta ? { meta: ListItem._cloneMeta(this.meta) } : {}),
            children: this.children.map(child => child.getState()),
        };

        return state;
    }
}

export default ListItem;
