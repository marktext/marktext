import type { Muya } from '../../../muya';
import type { IOrderListState } from '../../../state/types';
import type ListItem from '../listItem';
import { CLASS_NAMES } from '../../../config';
import { mixins } from '../../../utils';
import { LinkedList } from '../../base/linkedList/linkedList';
import Parent from '../../base/parent';
import IContainerQueryBlock from '../../mixins/containerQueryBlock';
import { ScrollPage } from '../../scrollPage';

function cloneOrderListMeta(meta: IOrderListState['meta']): IOrderListState['meta'] {
    return {
        ...meta,
        ...(meta.sourceMarkers ? { sourceMarkers: [...meta.sourceMarkers] } : {}),
    };
}

@mixins(IContainerQueryBlock)
class OrderList extends Parent {
    public override children: LinkedList<Parent> = new LinkedList();
    public meta: IOrderListState['meta'];

    static override blockName = 'order-list';

    static create(muya: Muya, state: IOrderListState) {
        const orderList = new OrderList(muya, state);

        orderList.append(
            ...state.children.map(child =>
                ScrollPage.loadBlock(child.name).create(muya, child),
            ),
        );

        return orderList;
    }

    override get path() {
        const { path: pPath } = this.parent!;
        const offset = this.parent!.offset(this);

        return [...pPath, offset, 'children'];
    }

    constructor(muya: Muya, { meta }: IOrderListState) {
        super(muya);
        this.tagName = 'ol';
        this.meta = cloneOrderListMeta(meta);
        this.attributes = { start: String(this.meta.start) };
        this.datasets = { delimiter: this.meta.delimiter };
        this.classList = [CLASS_NAMES.MU_ORDER_LIST];
        if (!this.meta.loose)
            this.classList.push('mu-tight-list');

        this.createDomNode();
    }

    override getState(): IOrderListState {
        const state: IOrderListState = {
            name: 'order-list',
            meta: cloneOrderListMeta(this.meta),
            children: this.children.map(child => (child as ListItem).getState()),
        };

        return state;
    }
}

export default OrderList;
