import type Content from '../block/base/content';
import type Format from '../block/base/format';
import type Parent from '../block/base/parent';
import type ListItem from '../block/commonMark/listItem';
import type TaskListItem from '../block/gfm/taskListItem';
import type { Muya } from '../muya';
import type Selection from './index';
import type { ICursor, INodeOffset, ISelection } from './types';
import { BLOCK_DOM_PROPERTY } from '../config';
import { isHTMLElement, isMouseEvent } from '../utils';
import {
    buildSelectionAffiliation,
    endpointBlockInfo,
} from './affiliation';
import { getCursorCoords } from './cursorCoords';
import {
    compareParagraphsOrder,
    findContentDOM,
    getNodeAndOffset,
    getOffsetOfParagraph,
} from './dom';

class TextSelection {
    public doc: Document = document;
    public anchorPath: (string | number)[] = [];
    public anchorBlock: Content | null = null;
    public focusPath: (string | number)[] = [];
    public focusBlock: Content | null = null;
    public anchor: INodeOffset | null = null;
    public focus: INodeOffset | null = null;

    private _selectInfo: {
        isSelect: boolean;
        selection: ICursor | null;
    } = {
        isSelect: false,
        selection: null,
    };

    constructor(private _muya: Muya, private _selection: Selection) {
        this._listenSelectActions();
    }

    get scrollPage() {
        return this._muya.editor.scrollPage;
    }

    get isCollapsed() {
        const { anchorBlock, focusBlock, anchor, focus } = this;

        if (anchor === null || focus === null)
            return false;

        return anchorBlock === focusBlock && anchor.offset === focus.offset;
    }

    get isSelectionInSameBlock() {
        const { anchorBlock, focusBlock, anchor } = this;

        if (anchor === null || focus === null)
            return false;

        return anchorBlock === focusBlock;
    }

    get direction() {
        const {
            anchor,
            focus,
            anchorBlock,
            focusBlock,
            isSelectionInSameBlock,
            isCollapsed,
        } = this;
        if (anchor === null || focus === null || !anchorBlock || !focusBlock)
            return 'none';

        if (isCollapsed)
            return 'none';

        if (isSelectionInSameBlock) {
            return anchor.offset < focus.offset ? 'forward' : 'backward';
        }
        else {
            const aDom = anchorBlock.domNode!;
            const fDom = focusBlock.domNode!;
            const order = compareParagraphsOrder(aDom, fDom);

            return order ? 'forward' : 'backward';
        }
    }

    get type() {
        const { anchorBlock, focusBlock, isCollapsed } = this;
        if (!anchorBlock && !focusBlock)
            return 'None';

        return isCollapsed ? 'Caret' : 'Range';
    }

    collapse(): void {
        this.setSelection({ anchor: null, focus: null });
    }

    selectAllContent() {
        const { scrollPage } = this;
        const aBlock = scrollPage?.firstContentInDescendant();
        const fBlock = scrollPage?.lastContentInDescendant();

        if (aBlock == null || fBlock == null)
            return;

        const cursor: ICursor = {
            anchor: { offset: 0 },
            focus: { offset: fBlock.text.length },
            anchorBlock: aBlock,
            anchorPath: aBlock.path,
            focusBlock: fBlock,
            focusPath: fBlock.path,
        };

        this.setSelection(cursor);
        const activeEle = this.doc.activeElement;
        if (isHTMLElement(activeEle) && activeEle.classList.contains('mu-content'))
            activeEle.blur();
    }

    getSelection(): ISelection | null {
        const selection = document.getSelection();

        if (!selection)
            return null;

        const { anchorNode, anchorOffset, focusNode, focusOffset } = selection;

        if (!anchorNode || !focusNode)
            return null;

        const anchorDomNode = findContentDOM(anchorNode);
        const focusDomNode = findContentDOM(focusNode);

        if (!anchorDomNode || !focusDomNode)
            return null;

        const anchorBlock = anchorDomNode[BLOCK_DOM_PROPERTY] as Content | undefined;
        const focusBlock = focusDomNode[BLOCK_DOM_PROPERTY] as Content | undefined;
        // An `mu-content` span cloned by the browser's native edit
        // behavior is not linked back to a block. Bail out instead of
        // crashing — the caller treats null the same as "no selection".
        if (!anchorBlock || !focusBlock)
            return null;
        const anchorPath = anchorBlock.path;
        const focusPath = focusBlock.path;

        const aOffset
            = getOffsetOfParagraph(anchorNode, anchorDomNode) + anchorOffset;
        const fOffset = getOffsetOfParagraph(focusNode, focusDomNode) + focusOffset;
        const anchor = { offset: aOffset };
        const focus = { offset: fOffset };

        const isCollapsed
            = anchorBlock === focusBlock && anchor.offset === focus.offset;

        const isSelectionInSameBlock = anchorBlock === focusBlock;
        let direction: string;

        if (isSelectionInSameBlock) {
            direction = anchor.offset < focus.offset ? 'forward' : 'backward';
        }
        else {
            const aDom = anchorBlock.domNode!;
            const fDom = focusBlock.domNode!;
            const order = compareParagraphsOrder(aDom, fDom);
            direction = order ? 'forward' : 'backward';
        }

        const type = isCollapsed ? 'Caret' : 'Range';

        return {
            anchor,
            focus,
            anchorBlock,
            anchorPath,
            focusBlock,
            focusPath,
            isCollapsed,
            isSelectionInSameBlock,
            direction,
            type,
        };
    }

    setSelection({
        anchor,
        focus,
        block,
        path,
        anchorBlock,
        anchorPath,
        focusBlock,
        focusPath,
    }: ICursor) {
        this.anchor = anchor ?? null;
        this.focus = focus ?? null;
        this.anchorBlock = anchorBlock ?? block ?? null;
        this.anchorPath = anchorPath ?? path ?? [];
        this.focusBlock = focusBlock ?? block ?? null;
        this.focusPath = focusPath ?? path ?? [];
        this._setCursor();

        const {
            isCollapsed,
            isSelectionInSameBlock,
            direction,
            type,
        } = this;

        // Follow the caret (focus end) for forward selections so typewriter
        // scrolling tracks the cursor rather than the selection start.
        const cursorCoords = getCursorCoords(direction === 'forward');
        // Duck-type the Format block — a value import of Format here would
        // create a selection -> format circular dependency.
        const anchorBlockRef = this.anchorBlock as Format | null;
        const formats
            = isSelectionInSameBlock
                && anchorBlockRef
                && typeof anchorBlockRef.getFormatsInRange === 'function'
                ? anchorBlockRef.getFormatsInRange().formats
                : [];

        const affiliation = buildSelectionAffiliation(
            this.anchorBlock,
            this.focusBlock,
        );
        const anchorBlockInfo = endpointBlockInfo(this.anchorBlock);
        const focusBlockInfo = endpointBlockInfo(this.focusBlock);

        this._muya.eventCenter.emit('selection-change', {
            anchor,
            focus,
            anchorBlock,
            anchorPath,
            focusBlock,
            focusPath,
            isCollapsed,
            isSelectionInSameBlock,
            direction,
            type,
            kind: 'text',
            selection: this,
            selectedImage: this._selection.image,
            cursorCoords,
            formats,
            affiliation,
            anchorBlockInfo,
            focusBlockInfo,
        });
    }

    private _listenSelectActions() {
        const { eventCenter, domNode } = this._muya;

        const handleMousedown = () => {
            this._selectInfo = {
                isSelect: true,
                selection: null,
            };
        };

        const handleMouseupOrLeave = () => {
            if (this._selectInfo.selection)
                this.setSelection(this._selectInfo.selection);

            this._selectInfo = {
                isSelect: false,
                selection: null,
            };
        };

        const handleMousemoveOrClick = (event: Event) => {
            if (!isMouseEvent(event))
                return;

            const { type, shiftKey } = event;
            if (type === 'mousemove' && !this._selectInfo.isSelect)
                return;

            if (type === 'click' && !shiftKey)
                return;

            const selection = this.getSelection();
            if (!selection)
                return;

            const {
                anchor,
                focus,
                anchorBlock,
                focusBlock,
                isSelectionInSameBlock,
                direction,
            } = selection;

            if (isSelectionInSameBlock) {
                return;
            }

            const newSelection = {
                anchor,
                focus,
                anchorBlock,
                focusBlock,
                anchorPath: anchorBlock.path,
                focusPath: focusBlock.path,
            };

            const anchorOutMostBlock = anchorBlock.outMostBlock as Parent;
            const focusOutMostBlock = focusBlock.outMostBlock as Parent;
            if (
                /block-quote|code-block|html-block|table|math-block|frontmatter|diagram/.test(
                    anchorOutMostBlock.blockName,
                )
            ) {
                const firstContent = anchorOutMostBlock.firstContentInDescendant()!;
                const lastContent = anchorOutMostBlock.lastContentInDescendant()!;

                if (direction === 'forward') {
                    newSelection.anchorBlock = firstContent;
                    newSelection.anchorPath = firstContent.path;
                    newSelection.anchor.offset = 0;
                }
                else {
                    newSelection.anchorBlock = lastContent;
                    newSelection.anchorPath = lastContent.path;
                    newSelection.anchor.offset = lastContent.text.length;
                }
            }

            if (
                /block-quote|code-block|html-block|table|math-block|frontmatter|diagram/.test(
                    focusOutMostBlock.blockName,
                )
            ) {
                const firstContent = focusOutMostBlock.firstContentInDescendant()!;
                const lastContent = focusOutMostBlock.lastContentInDescendant()!;
                if (direction === 'forward') {
                    newSelection.focusBlock = lastContent;
                    newSelection.focusPath = lastContent.path;
                    newSelection.focus.offset = lastContent.text.length;
                }
                else {
                    newSelection.focusBlock = firstContent;
                    newSelection.focusPath = firstContent.path;
                    newSelection.focus.offset = 0;
                }
            }

            if (
                /bullet-list|order-list|task-list/.test(anchorOutMostBlock.blockName)
            ) {
                const listItemBlockName
                    = anchorOutMostBlock.blockName === 'task-list'
                        ? 'task-list-item'
                        : 'list-item';
                const listItem = anchorBlock.farthestBlock(listItemBlockName) as
                    | ListItem
                    | TaskListItem;
                const firstContent = listItem.firstContentInDescendant()!;
                const lastContent = listItem.lastContentInDescendant()!;
                if (direction === 'forward') {
                    newSelection.anchorBlock = firstContent;
                    newSelection.anchorPath = firstContent.path;
                    newSelection.anchor.offset = 0;
                }
                else {
                    newSelection.anchorBlock = lastContent;
                    newSelection.anchorPath = lastContent.path;
                    newSelection.anchor.offset = lastContent.text.length;
                }
            }

            if (
                /bullet-list|order-list|task-list/.test(focusOutMostBlock.blockName)
            ) {
                const listItemBlockName
                    = focusOutMostBlock.blockName === 'task-list'
                        ? 'task-list-item'
                        : 'list-item';
                const listItem = focusBlock.farthestBlock(listItemBlockName) as
                    | ListItem
                    | TaskListItem;
                const firstContent = listItem.firstContentInDescendant()!;
                const lastContent = listItem.lastContentInDescendant()!;
                if (direction === 'forward') {
                    newSelection.focusBlock = lastContent;
                    newSelection.focusPath = lastContent.path;
                    newSelection.focus.offset = lastContent.text.length;
                }
                else {
                    newSelection.focusBlock = firstContent;
                    newSelection.focusPath = firstContent.path;
                    newSelection.focus.offset = 0;
                }
            }

            if (type === 'mousemove')
                this._selectInfo.selection = newSelection;
            else
                this.setSelection(newSelection);
        };

        eventCenter.attachDOMEvent(domNode, 'mousedown', handleMousedown);
        eventCenter.attachDOMEvent(domNode, 'mousemove', handleMousemoveOrClick);
        eventCenter.attachDOMEvent(domNode, 'mouseup', handleMouseupOrLeave);
        eventCenter.attachDOMEvent(domNode, 'mouseleave', handleMouseupOrLeave);
        eventCenter.attachDOMEvent(domNode, 'click', handleMousemoveOrClick);
    }

    private _selectRange(range: Range) {
        const selection = this.doc.getSelection();

        if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    private _select(
        startNode: Node,
        startOffset: number,
        endNode?: Node,
        endOffset?: number,
    ) {
        const range = this.doc.createRange();
        range.setStart(startNode, startOffset);
        if (endNode && typeof endOffset === 'number')
            range.setEnd(endNode, endOffset);
        else
            range.collapse(true);

        this._selectRange(range);

        return range;
    }

    private _setFocus(focusNode: Node, focusOffset: number) {
        const selection = this.doc.getSelection();
        if (selection)
            selection.extend(focusNode, focusOffset);
    }

    private _setCursor() {
        const {
            anchor,
            focus,
            anchorBlock,
            anchorPath,
            focusBlock,
            focusPath,
            scrollPage,
        } = this;

        if (!anchor || !focus) {
            const selection = this.doc.getSelection();
            if (selection)
                selection.removeAllRanges();

            return;
        }

        const anchorParagraph = anchorBlock
            ? anchorBlock.domNode
            : scrollPage?.queryBlock(anchorPath);
        const focusParagraph = focusBlock
            ? focusBlock.domNode
            : scrollPage?.queryBlock(focusPath);

        // getNodeAndOffset expects a DOM Node. The fallback branch can hand
        // back a Parent/Content block (from scrollPage.queryBlock); narrow to
        // an actual Node here, preserving the existing not-found behavior.
        if (!(anchorParagraph instanceof Node) || !(focusParagraph instanceof Node))
            return;
        const { node: anchorNode, offset: anchorOffset } = getNodeAndOffset(
            anchorParagraph,
            anchor.offset,
        );
        const { node: focusNode, offset: focusOffset } = getNodeAndOffset(
            focusParagraph,
            focus.offset,
        );

        this._select(anchorNode, anchorOffset);
        this._setFocus(focusNode, focusOffset);
    }
}

export default TextSelection;
