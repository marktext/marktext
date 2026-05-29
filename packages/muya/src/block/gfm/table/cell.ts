import type Table from '.';
import type { Muya } from '../../../muya';
import type { ITableCellMeta, ITableCellState } from '../../../state/types';
import type TableCellContent from '../../content/tableCell';
import type Row from './row';
import type TableInner from './table';
import { mixins } from '../../../utils';
import { LinkedList } from '../../base/linkedList/linkedList';
import Parent from '../../base/parent';
import LeafQueryBlock from '../../mixins/leafQueryBlock';
import { ScrollPage } from '../../scrollPage';

@mixins(LeafQueryBlock)
class TableBodyCell extends Parent {
    override children: LinkedList<TableCellContent> = new LinkedList();

    public meta: ITableCellMeta;

    static override blockName = 'table.cell';

    static create(muya: Muya, state: ITableCellState) {
        const cell = new TableBodyCell(muya, state);

        cell.append(
            ScrollPage.loadBlock('table.cell.content').create(muya, state.text),
        );

        return cell;
    }

    override get path() {
        const { path: pPath } = this.parent!;
        const offset = this.parent!.offset(this);

        return [...pPath, 'children', offset];
    }

    get table() {
        return this.closestBlock('table') as Table;
    }

    get row() {
        return this.closestBlock('table.row') as Row;
    }

    get rowOffset() {
        return (this.table.firstChild as TableInner).offset(this.row);
    }

    get columnOffset() {
        return this.row!.offset(this);
    }

    get align() {
        return this.meta.align;
    }

    set align(value) {
        this.domNode!.dataset.align = value;
        this.meta.align = value;
    }

    constructor(muya: Muya, { meta }: ITableCellState) {
        super(muya);
        this.tagName = 'td';
        this.meta = meta;
        this.datasets = {
            align: meta.align,
        };
        this.classList = ['mu-table-cell'];
        this.createDomNode();
    }

    override getState(): ITableCellState {
        const state: ITableCellState = {
            name: 'table.cell',
            meta: { ...this.meta },
            text: (this.firstChild as TableCellContent).text,
        };

        return state;
    }
}

export default TableBodyCell;
