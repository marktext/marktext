import type { Muya } from '../../../muya';
import type { IRenderCursor } from '../../../selection/types';
import type Table from '../../gfm/table';
import type Cell from '../../gfm/table/cell';
import type Row from '../../gfm/table/row';
import type TableInner from '../../gfm/table/table';
import { EVENT_KEYS, isOsx } from '../../../config';
import { isKeyboardEvent } from '../../../utils';
import Format from '../../base/format';
import { ScrollPage } from '../../scrollPage';

class TableCellContent extends Format {
    public hasZeroWidthSpaceAtBeginning: boolean = false;

    static override blockName = 'table.cell.content';

    static create(muya: Muya, text: string) {
        const content = new TableCellContent(muya, text);

        return content;
    }

    get table() {
        return this.closestBlock('table') as Table;
    }

    get tableInner() {
        return this.closestBlock('table.inner') as TableInner;
    }

    get row() {
        return this.closestBlock('table.row') as Row;
    }

    get cell() {
        return this.closestBlock('table.cell') as Cell;
    }

    constructor(muya: Muya, text: string) {
        super(muya, text);
        this.classList = [...this.classList, 'mu-table-cell-content'];
        this.createDomNode();
    }

    override getAnchor() {
        return this.table;
    }

    override update(cursor?: IRenderCursor, highlights = []) {
        return this.inlineRenderer.patch(this, cursor, highlights);
    }

    findNextRow() {
        const { row } = this;

        return row.next || null;
    }

    findPreviousRow() {
        const { row } = this;

        return row.prev || null;
    }

    shiftEnter(event: Event) {
        event.preventDefault();

        const { start, end } = this.getCursor()!;
        const { text } = this;

        const br = '<br/>';

        this.text
            = text.substring(0, start.offset) + br + text.substring(end.offset);
        const offset = start.offset + br.length;
        this.setCursor(offset, offset, true);
    }

    commandEnter(event: Event) {
        event.preventDefault();

        const offset = this.tableInner.offset(this.row);
        const cursorBlock = this.table.insertRow(
            offset + 1, /* Because insert after the current row */
        );
        cursorBlock.setCursor(0, 0);
    }

    normalEnter(event: Event) {
        event.preventDefault();

        const nextRow = this.findNextRow();
        const { row } = this;
        let cursorBlock = null;
        if (nextRow) {
            cursorBlock = nextRow.firstContentInDescendant();
        }
        else {
            const lastCellContent = row.lastContentInDescendant();
            const nextContent = lastCellContent?.nextContentInContext();

            if (nextContent) {
                cursorBlock = nextContent;
            }
            else {
                const state = {
                    name: 'paragraph',
                    text: '',
                };

                const newParagraphBlock = ScrollPage.loadBlock('paragraph').create(
                    this.muya,
                    state,
                );
                this.scrollPage?.append(newParagraphBlock, 'user');
                cursorBlock = newParagraphBlock.firstContentInDescendant();
            }
        }

        cursorBlock.setCursor(0, 0, true);
    }

    override enterHandler(event: Event) {
        if (!isKeyboardEvent(event))
            return;

        if (event.shiftKey)
            return this.shiftEnter(event);
        else if ((isOsx && event.metaKey) || (!isOsx && event.ctrlKey))
            return this.commandEnter(event);
        else
            return this.normalEnter(event);
    }

    override arrowHandler(event: Event) {
        if (!isKeyboardEvent(event))
            return;

        const previousRow = this.findPreviousRow();
        const nextRow = this.findNextRow();
        const { table, cell, row } = this;
        const offset = row.offset(cell);
        const tablePrevContent = table.prev
            ? table.prev.lastContentInDescendant()
            : null;
        const tableNextContent = table.next
            ? table.next.firstContentInDescendant()
            : null;

        if (event.key === EVENT_KEYS.ArrowUp) {
            event.preventDefault();
            if (previousRow) {
                const cursorBlock = (
                    previousRow.find(offset) as Cell
                ).firstContentInDescendant();

                if (cursorBlock) {
                    const cursorOffset = cursorBlock.text.length;
                    cursorBlock.setCursor(cursorOffset, cursorOffset, true);
                }
            }
            else if (tablePrevContent) {
                const cursorOffset = tablePrevContent.text.length;
                tablePrevContent.setCursor(cursorOffset, cursorOffset, true);
            }
        }
        else if (event.key === EVENT_KEYS.ArrowDown) {
            event.preventDefault();

            if (nextRow) {
                const cursorBlock = (
                    nextRow.find(offset) as Cell
                ).firstContentInDescendant();

                cursorBlock?.setCursor(0, 0, true);
            }
            else {
                let cursorBlock = null;
                if (tableNextContent) {
                    cursorBlock = tableNextContent;
                }
                else {
                    const state = {
                        name: 'paragraph',
                        text: '',
                    };

                    const newParagraphBlock = ScrollPage.loadBlock('paragraph').create(
                        this.muya,
                        state,
                    );
                    this.scrollPage?.append(newParagraphBlock, 'user');
                    cursorBlock = newParagraphBlock.firstContentInDescendant();
                }

                cursorBlock.setCursor(0, 0, true);
            }
        }
        else {
            super.arrowHandler(event);
        }
    }

    override backspaceHandler(event: Event) {
        const { start, end } = this.getCursor()!;
        const previousContentBlock = this.previousContentInContext();

        if (start.offset !== 0 || start.offset !== end.offset)
            return super.backspaceHandler(event);

        event.preventDefault();
        event.stopPropagation();

        if (
            !previousContentBlock
            || (previousContentBlock.blockName !== 'table.cell.content'
                && this.table.isEmpty())
        ) {
            const state = {
                name: 'paragraph',
                text: '',
            };
            const newParagraphBlock = ScrollPage.loadBlock('paragraph').create(
                this.muya,
                state,
            );
            this.table.replaceWith(newParagraphBlock);
            newParagraphBlock.firstChild.setCursor(0, 0);
        }
        else {
            const offset = previousContentBlock.text.length;
            previousContentBlock.setCursor(offset, offset, true);
        }
    }

    override tabHandler(event: Event) {
        event.preventDefault();
        event.stopPropagation();

        // Shift+Tab back-navigates inside the table (header row's first cell
        // stays put when there is no previous content).
        // Read shiftKey directly — pointer Tab is not a thing, so callers
        // always pass a KeyboardEvent in practice. The structural check just
        // keeps unit tests that pass a partial event object passing.
        const isShiftTab = 'shiftKey' in event && event.shiftKey === true;
        const cursorBlock = isShiftTab
            ? this.previousContentInContext()
            : this.nextContentInContext();

        if (cursorBlock)
            cursorBlock.setCursor(0, 0, true);
    }

    // The following code is used to fix a bug in Safari,
    // entering Chinese in an empty table cell will cause
    // the table to be messed up, so we insert a zero-width
    // character before entering the Chinese, and remove the
    // zero-width character after entering the Chinese.
    override composeHandler(event: Event) {
        super.composeHandler(event);
        if (event.type === 'compositionstart' && this.text === '') {
            this.hasZeroWidthSpaceAtBeginning = true;
            this.domNode!.textContent = '\u200B';
        }
        else if (event.type === 'compositionend' && this.hasZeroWidthSpaceAtBeginning) {
            this.hasZeroWidthSpaceAtBeginning = false;
            const { text } = this;
            const offset = text.length - 1;
            this.text = text.substring(0, offset);
            this.setCursor(offset, offset, true);
        }
    }
}

export default TableCellContent;
