import type Content from '../block/base/content';
import type BulletList from '../block/commonMark/bulletList';
import type OrderList from '../block/commonMark/orderList';
import type TaskList from '../block/gfm/taskList';
import type { TBlockPath } from '../block/types';
import type { Muya } from '../muya';
import type { Nullable } from '../types';
import type Selection from './index';
import type { IAnchorFocusInfo, INodeOffset, IResolvedTextSelection, ISelectionEndpoints } from './types';
import { revealBlock } from '../block/folding';
import { isHTMLElement, isMouseEvent } from '../utils';
import logger from '../utils/logger';
import { collapsedPreviewEndpoint, collapsedSyntaxBoundaries, snapToCollapsedSyntax } from './collapsedSyntax';
import {
    compareParagraphsOrder,
    endpointAtPoint,
    getLegalOffset,
    getNodeAndOffset,
    lineAtPoint,
    resolveEndpoint,
} from './dom';
import { SelectionDirection } from './types';

const debug = logger('textselection:');

// Code, table and tight-list content is newline-separated; anything else needs
// a blank line, which is also what would re-parse a tight list as loose.
function getTextSeparator(previous: Content, next: Content): string {
    const ancestors = next.getAncestors();
    let container = previous.getAncestors().find(block => ancestors.includes(block));
    if (container?.blockName === 'list-item' || container?.blockName === 'task-list-item')
        container = container.parent ?? undefined;

    if (container?.blockName === 'code-block' || container?.blockName.startsWith('table'))
        return '\n';

    if (container && ['bullet-list', 'order-list', 'task-list'].includes(container.blockName)) {
        const list = container as BulletList | OrderList | TaskList;
        return list.meta.loose ? '\n\n' : '\n';
    }

    return '\n\n';
}

function computeDirection(
    anchorBlock: Content,
    focusBlock: Content,
    anchorOffset: number,
    focusOffset: number,
    isSelectionInSameBlock: boolean,
): SelectionDirection {
    if (isSelectionInSameBlock) {
        return anchorOffset < focusOffset
            ? SelectionDirection.FORWARD
            : SelectionDirection.BACKWARD;
    }

    return compareParagraphsOrder(anchorBlock.domNode!, focusBlock.domNode!)
        ? SelectionDirection.FORWARD
        : SelectionDirection.BACKWARD;
}

class TextSelection {
    public anchorPath: TBlockPath = [];
    public anchorBlock: Nullable<Content> = null;
    public focusPath: TBlockPath = [];
    public focusBlock: Nullable<Content> = null;
    public anchor: Nullable<INodeOffset> = null;
    public focus: Nullable<INodeOffset> = null;

    private _doc: Document = document;

    private _selectInfo: {
        isSelect: boolean;
        selection: ISelectionEndpoints | null;
        boundaries: Map<Content, ReturnType<typeof collapsedSyntaxBoundaries>>;
        anchor: IAnchorFocusInfo | null;
        focus: IAnchorFocusInfo | null;
        moved: boolean;
    } = {
        isSelect: false,
        selection: null,
        boundaries: new Map(),
        anchor: null,
        focus: null,
        moved: false,
    };

    constructor(private _muya: Muya, private _selection: Selection) {
        this._listenSelectActions();
    }

    private get _scrollPage() {
        return this._muya.editor.scrollPage;
    }

    get isSelectionInSameBlock() {
        const { anchorBlock, focusBlock, anchor, focus } = this;

        if (anchor == null || focus == null)
            return false;

        return anchorBlock === focusBlock;
    }

    collapse(): void {
        this.anchor = null;
        this.focus = null;
        this.anchorBlock = null;
        this.focusBlock = null;
        this.anchorPath = [];
        this.focusPath = [];
        this._updateSelection();
        this._emitSelectionChange();
    }

    selectAllContent() {
        const { _scrollPage: scrollPage } = this;
        const aBlock = scrollPage?.firstContentInDescendant();
        const fBlock = scrollPage?.lastContentInDescendant();

        if (aBlock == null || fBlock == null)
            return;

        if (this._muya.isReadOnly) {
            const first = aBlock.domNode;
            const last = fBlock.domNode;
            if (!first || !last)
                return;
            // Reading selections must preserve folding and avoid editor selection side effects.
            const range = this._doc.createRange();
            range.setStart(first, 0);
            range.setEnd(last, last.childNodes.length);
            this._selectRange(range);
            return;
        }

        this.setSelection(
            {
                offset: 0,
                block: aBlock,
                path: aBlock.path,
            },
            {
                offset: fBlock.text.length,
                block: fBlock,
                path: fBlock.path,
            },
        );
        const activeEle = this._doc.activeElement;
        if (isHTMLElement(activeEle) && activeEle.classList.contains('mu-content'))
            activeEle.blur();
    }

    getSelection(): IResolvedTextSelection | null {
        const selection = this._doc.getSelection();

        if (!selection)
            return null;

        const { anchorNode, anchorOffset, focusNode, focusOffset } = selection;

        if (!anchorNode || !focusNode)
            return null;

        const dragging = this._selectInfo.isSelect && (this._selectInfo.moved || !selection.isCollapsed);
        const anchor = (dragging && this._selectInfo.anchor) || resolveEndpoint(anchorNode, anchorOffset);
        const focus = (dragging && this._selectInfo.focus) || resolveEndpoint(focusNode, focusOffset);

        if (!anchor || !focus)
            return null;

        if (dragging) {
            for (const endpoint of [anchor, focus]) {
                const { block } = endpoint;
                let boundaries = this._selectInfo.boundaries.get(block);
                if (!boundaries) {
                    boundaries = collapsedSyntaxBoundaries(block);
                    this._selectInfo.boundaries.set(block, boundaries);
                }
                endpoint.offset = snapToCollapsedSyntax(endpoint.offset, boundaries);
            }
        }

        const anchorBlock = anchor.block;
        const focusBlock = focus.block;
        const isCollapsed = anchorBlock === focusBlock && anchor.offset === focus.offset;
        const isSelectionInSameBlock = anchorBlock === focusBlock;

        return {
            anchor,
            focus,
            isCollapsed,
            isSelectionInSameBlock,
            direction: isCollapsed
                ? SelectionDirection.NONE
                : computeDirection(
                        anchorBlock,
                        focusBlock,
                        anchor.offset,
                        focus.offset,
                        isSelectionInSameBlock,
                    ),
        };
    }

    getSelectedText(selection = this.getSelection()): string {
        if (!selection || selection.isCollapsed)
            return '';

        const { anchor, focus, direction } = selection;
        // `getSelection()` resolves whichever editor the range landed in.
        if (anchor.block.muya !== this._muya || focus.block.muya !== this._muya)
            return '';

        const [start, end] = direction === SelectionDirection.BACKWARD ? [focus, anchor] : [anchor, focus];
        if (start.block === end.block)
            return start.block.text.slice(start.offset, end.offset);

        const parts = [start.block.text.slice(start.offset)];
        let previous = start.block;
        let block = previous.nextContentInContext();
        while (block) {
            parts.push(getTextSeparator(previous, block), block === end.block ? block.text.slice(0, end.offset) : block.text);
            if (block === end.block)
                return parts.join('');
            previous = block;
            block = block.nextContentInContext();
        }

        // `direction` is DOM order, the walk is tree order: they disagree only
        // for a block no longer in the document.
        debug.warn('the selection end is not reachable from its start');

        return '';
    }

    setSelection(anchor: IAnchorFocusInfo, focus: IAnchorFocusInfo) {
        if (anchor.block !== focus.block)
            this._muya.editor.activeContentBlock = null;
        if (!this._muya.isReadOnly) {
            revealBlock(anchor.block);
            revealBlock(focus.block);
        }
        this.anchor = {
            offset: anchor.offset,
        };
        this.anchorBlock = anchor.block;
        this.anchorPath = anchor.path;
        this.focus = {
            offset: focus.offset,
        };
        this.focusBlock = focus.block;
        this.focusPath = focus.path;
        this._updateSelection();
        this._emitSelectionChange();
    }

    private _emitSelectionChange() {
        this._selection.syncTextSelection();
    }

    private _listenSelectActions() {
        const { eventCenter, domNode } = this._muya;

        const handleMousedown = (event: Event) => {
            if (this._muya.isReadOnly || !isMouseEvent(event) || event.button !== 0)
                return;
            this._selectInfo = {
                isSelect: true,
                selection: null,
                boundaries: new Map(),
                anchor: event.shiftKey ? null : collapsedPreviewEndpoint(this._doc.elementFromPoint(event.clientX, event.clientY), event.clientX, event.clientY),
                focus: null,
                moved: false,
            };

            if (event.detail < 3)
                return;

            const line = lineAtPoint(this._doc, event.clientX, event.clientY);
            if (!line)
                return;

            event.preventDefault();
            this._selectInfo.isSelect = false;
            line.block.setCursor(line.start, line.end);
        };

        const handleMouseup = (event: Event) => {
            if (this._muya.isReadOnly)
                return;
            if (!this._selectInfo.isSelect)
                return;
            if (isMouseEvent(event))
                this._selectInfo.focus = this._pointerFocus(event);
            const selection = this.getSelection() ?? this._selectInfo.selection;
            if (!this._selection.table.hasSelection
                && selection?.anchor.block.outMostBlock && selection.focus.block.outMostBlock
                && (selection.anchor.block !== selection.focus.block || selection.anchor.offset !== selection.focus.offset)) {
                this.setSelection(selection.anchor, selection.focus);
            }

            this._resetDrag();
        };

        const handleMousemoveOrClick = (event: Event) => {
            if (this._muya.isReadOnly)
                return;
            if (!isMouseEvent(event))
                return;

            const { type, shiftKey } = event;
            if (type === 'mousemove' && !this._selectInfo.isSelect)
                return;

            if (type === 'mousemove' && event.buttons !== 1) {
                this._resetDrag();
                return;
            }

            if (type === 'click' && !shiftKey)
                return;

            if (type === 'mousemove' && event.buttons === 1)
                this._selectInfo.moved = true;
            this._selectInfo.focus = this._pointerFocus(event);
            const selection = this.getSelection();
            if (!selection)
                return;

            const { anchor, focus, isSelectionInSameBlock } = selection;

            if (isSelectionInSameBlock) {
                return;
            }

            const anchorBlock = anchor.block;
            const focusBlock = focus.block;
            const endpointAnchor = {
                offset: anchor.offset,
                block: anchorBlock,
                path: anchorBlock.path,
            };
            const endpointFocus = {
                offset: focus.offset,
                block: focusBlock,
                path: focusBlock.path,
            };

            if (type === 'mousemove') {
                this._selectInfo.selection = {
                    anchor: endpointAnchor,
                    focus: endpointFocus,
                };
            }
            else {
                this.setSelection(endpointAnchor, endpointFocus);
            }
        };

        eventCenter.attachDOMEvent(domNode, 'mousedown', handleMousedown);
        eventCenter.attachDOMEvent(domNode, 'mousemove', handleMousemoveOrClick);
        eventCenter.attachDOMEvent(this._doc, 'mouseup', handleMouseup);
        // A release outside the window must not carry drag snapping into keyboard edits.
        eventCenter.attachDOMEvent(this._doc, 'keydown', () => this._resetDrag(), true);
        eventCenter.attachDOMEvent(domNode, 'click', handleMousemoveOrClick);
    }

    private _resetDrag() {
        this._selectInfo.isSelect = false;
        this._selectInfo.selection = null;
        this._selectInfo.boundaries.clear();
        this._selectInfo.anchor = null;
        this._selectInfo.focus = null;
        this._selectInfo.moved = false;
    }

    private _pointerFocus(event: MouseEvent): IAnchorFocusInfo | null {
        const { clientX, clientY } = event;
        return collapsedPreviewEndpoint(this._doc.elementFromPoint(clientX, clientY), clientX, clientY)
            ?? (this._selectInfo.anchor ? endpointAtPoint(this._doc, clientX, clientY) : null);
    }

    private _selectRange(range: Range) {
        const selection = this._doc.getSelection();

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
        const range = this._doc.createRange();
        range.setStart(startNode, getLegalOffset(startNode, startOffset));
        if (endNode && typeof endOffset === 'number')
            range.setEnd(endNode, getLegalOffset(endNode, endOffset));
        else
            range.collapse(true);

        this._selectRange(range);

        return range;
    }

    private _setFocus(focusNode: Node, focusOffset: number) {
        const selection = this._doc.getSelection();
        if (selection)
            selection.extend(focusNode, getLegalOffset(focusNode, focusOffset));
    }

    private _updateSelection() {
        const {
            anchor,
            focus,
            anchorBlock,
            anchorPath,
            focusBlock,
            focusPath,
            _scrollPage: scrollPage,
        } = this;

        if (!anchor || !focus) {
            const selection = this._doc.getSelection();
            const { domNode } = this._muya;
            if (selection && domNode.contains(selection.anchorNode) && domNode.contains(selection.focusNode)) {
                selection.removeAllRanges();
            }

            return;
        }

        const anchorParagraph = anchorBlock
            ? anchorBlock.domNode
            : scrollPage?.queryBlock(anchorPath);
        const focusParagraph = focusBlock
            ? focusBlock.domNode
            : scrollPage?.queryBlock(focusPath);

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
