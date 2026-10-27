import type { Muya } from '../../../muya';
import type { IOrderListState } from '../../../state/types';
import type Parent from '../../base/parent';
import type ListItem from '../listItem';
import { CLASS_NAMES } from '../../../config';
import { mixins } from '../../../utils';
import { LinkedList } from '../../base/linkedList/linkedList';
import ListBlock from '../../base/list';
import IContainerQueryBlock from '../../mixins/containerQueryBlock';
import { ScrollPage } from '../../scrollPage';

@mixins(IContainerQueryBlock)
class OrderList extends ListBlock {
    public override children: LinkedList<Parent> = new LinkedList();
    public override meta: IOrderListState['meta'];

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
        this.meta = meta;
        this.attributes = { start: String(meta.start) };
        this.datasets = { delimiter: meta.delimiter, ...(meta.style ? { style: meta.style } : {}) };
        this.classList = [CLASS_NAMES.MU_ORDER_LIST];
        this.createDomNode();
        this.setLoose(meta.loose);
    }

    override getState(): IOrderListState {
        const state: IOrderListState = {
            name: 'order-list',
            meta: { ...this.meta },
            children: this.children.map(child => (child as ListItem).getState()),
        };

        return state;
    }
}

export default OrderList;
