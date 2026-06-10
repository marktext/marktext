import type { ReferenceElement } from '@floating-ui/dom';
import type { VNode } from 'snabbdom';
import type { Muya } from '../../index';
import { EVENT_KEYS } from '../../config';
import { isHTMLElement, isHTMLInputElement } from '../../utils';
import { h, patch } from '../../utils/snabbdom';

import BaseFloat from '../baseFloat';

import './index.css';

interface ICheckerCount {
    row: number;
    column: number;
}

class TablePicker extends BaseFloat {
    static pluginName = 'tablePicker';

    private _checkerCount: ICheckerCount;
    private _oldVNode: VNode | null;
    private _current: ICheckerCount | null;
    private _select: ICheckerCount | null;
    private _tableContainer: HTMLElement;

    constructor(muya: Muya) {
        const name = 'mu-table-picker';
        super(muya, name);
        this._checkerCount = {
            row: 6,
            column: 8,
        };
        this._oldVNode = null;
        this._current = null;
        this._select = null;
        const tableContainer = (this._tableContainer
            = document.createElement('div'));
        this.container!.appendChild(tableContainer);
        this.listen();
    }

    override listen() {
        const { eventCenter } = this.muya;
        super.listen();
        eventCenter.subscribe('muya-table-picker', (data, reference, cb) => {
            if (!this.status) {
                this.showPicker(data, reference, cb);
                this.render();
            }
            else {
                this.hide();
            }
        });
    }

    render() {
        const { row, column } = this._checkerCount;
        const { row: cRow, column: cColumn } = this._current!;
        const { row: sRow, column: sColumn } = this._select!;
        const { _tableContainer: tableContainer, _oldVNode: oldVNode } = this;
        const tableRows = [];
        let i;
        let j;

        for (i = 0; i < row; i++) {
            let rowSelector = 'div.mu-table-picker-row';
            if (i === 0)
                rowSelector += '.mu-table-picker-header';

            const cells = [];

            for (j = 0; j < column; j++) {
                let cellSelector = 'span.mu-table-picker-cell';
                if (i <= cRow && j <= cColumn)
                    cellSelector += '.current';

                if (i <= sRow && j <= sColumn)
                    cellSelector += '.selected';

                cells.push(
                    h(cellSelector, {
                        key: j.toString(),
                        dataset: {
                            row: i.toString(),
                            column: j.toString(),
                        },
                        on: {
                            mouseenter: (event: MouseEvent) => {
                                if (!isHTMLElement(event.target))
                                    return;
                                const r = event.target.getAttribute('data-row');
                                const c = event.target.getAttribute('data-column');
                                this._select = { row: Number(r), column: Number(c) };
                                this.render();
                            },
                            click: (_) => {
                                this.selectItem();
                            },
                        },
                    }),
                );
            }

            tableRows.push(h(rowSelector, cells));
        }

        const tableFooter = h('div.footer', [
            h('input.row-input', {
                props: {
                    type: 'text',
                    value: +this._select!.row + 1,
                },
                on: {
                    keyup: (event: KeyboardEvent) => {
                        this.keyupHandler(event, 'row');
                    },
                },
            }),
            'x',
            h('input.column-input', {
                props: {
                    type: 'text',
                    value: +this._select!.column + 1,
                },
                on: {
                    keyup: (event: KeyboardEvent) => {
                        this.keyupHandler(event, 'column');
                    },
                },
            }),
            h(
                'button',
                {
                    on: {
                        click: (_) => {
                            this.selectItem();
                        },
                    },
                },
                'OK',
            ),
        ]);

        const vnode = h('div', [h('div.checker', tableRows), tableFooter]);

        if (oldVNode)
            patch(oldVNode, vnode);
        else
            patch(tableContainer, vnode);

        this._oldVNode = vnode;
    }

    keyupHandler(event: KeyboardEvent, type: 'row' | 'column') {
        let number = +this._select![type];
        const value = isHTMLInputElement(event.target) ? +event.target.value : Number.NaN;
        if (event.key === EVENT_KEYS.ArrowUp)
            number++;
        else if (event.key === EVENT_KEYS.ArrowDown)
            number--;
        else if (event.key === EVENT_KEYS.Enter)
            this.selectItem();
        else if (!Number.isNaN(value))
            number = value - 1;

        if (number !== +this._select![type]) {
            this._select![type] = Math.max(number, 0);
            this.render();
        }
    }

    showPicker(current: ICheckerCount, reference: ReferenceElement, cb: (row: number, column: number) => void) {
    // current { row, column } zero base
        this._current = current;
        // Clone so footer-input edits mutating `_select` never corrupt the
        // immutable `_current` start position (ICheckerCount is flat).
        this._select = { ...current };
        super.show(reference, cb);
    }

    selectItem() {
        const { cb } = this;
        const { row, column } = this._select!;
        cb(Math.max(row, 0), Math.max(column, 0));
        this.hide();
    }
}

export default TablePicker;
