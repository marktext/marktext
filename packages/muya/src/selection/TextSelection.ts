import type Content from '../block/base/content';
import type Format from '../block/base/format';
import type BulletList from '../block/commonMark/bulletList';
import type OrderList from '../block/commonMark/orderList';
import type TaskList from '../block/gfm/taskList';
import type { TBlockPath } from '../block/types';
import type { Muya } from '../muya';
import type { Nullable } from '../types';
import type Selection from './index';
import type { IAnchorFocusInfo, INodeOffset, ISelection } from './types';
import { BLOCK_DOM_PROPERTY, CLASS_NAMES } from '../config';
import { isHTMLElement, isMouseEvent } from '../utils';
import {
    buildSelectionAffiliation,
    endpointBlockInfo,
} from './affiliation';
import { getCursorCoords } from './cursorCoords';
import {
    compareParagraphsOrder,
    findContentDOM,
    getLegalOffset,
    getNodeAndOffset,
    getOffsetOfParagraph,
    getTextContent,
} from './dom';
import { SelectionCaretType, SelectionDirection, SelectionType } from './types';

function getContentPoint(node: Node, offset: number, isStart: boolean) {
    const paragraph = findContentDOM(node);
    if (paragraph)
        return { node, offset, paragraph };

    // Native ranges can end on a paragraph/container boundary, where the
    // offset is a child index rather than a character position.
    const findPoint = (forward: boolean) => {
        for (let i = forward ? offset : offset - 1; i >= 0 && i < node.childNodes.length; i += forward ? 1 : -1) {
            const child = node.childNodes[i];
            if (!(child instanceof HTMLElement))
                continue;
            const contents = child.querySelectorAll<HTMLElement>('.mu-content');
            const content = child.matches('.mu-content') ? child : contents[forward ? 0 : contents.length - 1];
            if (content)
                return { node: content, offset: forward ? 0 : content.childNodes.length, paragraph: content };
        }
        return null;
    };

    // At a boundary between blocks, keep the endpoint on the selected side.
    return findPoint(isStart) ?? findPoint(!isStart);
}

function getSourceOffset(node: Node, offset: number, paragraph: HTMLElement, isStart: boolean): number {
    const element = node instanceof Element ? node : node.parentElement;
    const preview = element?.closest(`.${CLASS_NAMES.MU_MATH_RENDER}, .${CLASS_NAMES.MU_RUBY_RENDER}`);
    if (preview)
        return Number(preview.getAttribute(isStart ? 'data-start' : 'data-end'));

    const innerOffset = node.nodeType === Node.TEXT_NODE
        ? offset
        : Array.from(node.childNodes).slice(0, offset).reduce((total, child) => total + getTextContent(child, [
                CLASS_NAMES.MU_MATH_RENDER,
                CLASS_NAMES.MU_RUBY_RENDER,
            ]).length, 0);

    return getOffsetOfParagraph(node, paragraph) + innerOffset;
}

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

function computeCaretType(
    anchorBlock: Nullable<Content>,
    focusBlock: Nullable<Content>,
    isCollapsed: boolean,
): SelectionCaretType {
    if (!anchorBlock && !focusBlock)
        return SelectionCaretType.NONE;

    return isCollapsed ? SelectionCaretType.CARET : SelectionCaretType.RANGE;
}

class TextSelection {
    public anchorPath: TBlockPath = [];
    public anchorBlock: Nullable<Content> = null;
    public focusPath: TBlockPath = [];
    public focusBlock: Nullable<Content> = null;
    public anchor: Nullable<INodeOffset> = null;
    public focus: Nullable<INodeOffset> = null;

    private _doc: Document = document;
    private _lastReportedSelection: ISelection | null = null;
    private _isComposing = false;

    private _selectInfo: {
        isSelect: boolean;
        selection: { anchor: IAnchorFocusInfo; focus: IAnchorFocusInfo } | null;
    } = {
        isSelect: false,
        selection: null,
    };

    constructor(private _muya: Muya, private _selection: Selection) {
        this._listenSelectActions();
    }

    private get _scrollPage() {
        return this._muya.editor.scrollPage;
    }

    private get _isCollapsed() {
        const { anchorBlock, focusBlock, anchor, focus } = this;

        if (anchor == null || focus == null)
            return false;

        return anchorBlock === focusBlock && anchor.offset === focus.offset;
    }

    get isSelectionInSameBlock() {
        const { anchorBlock, focusBlock, anchor, focus } = this;

        if (anchor == null || focus == null)
            return false;

        return anchorBlock === focusBlock;
    }

    private get _direction() {
        const {
            anchor,
            focus,
            anchorBlock,
            focusBlock,
            isSelectionInSameBlock,
            _isCollapsed: isCollapsed,
        } = this;
        if (anchor == null || focus == null || !anchorBlock || !focusBlock)
            return SelectionDirection.NONE;

        if (isCollapsed)
            return SelectionDirection.NONE;

        return computeDirection(
            anchorBlock,
            focusBlock,
            anchor.offset,
            focus.offset,
            isSelectionInSameBlock,
        );
    }

    private get _type() {
        const { anchorBlock, focusBlock, _isCollapsed: isCollapsed } = this;

        return computeCaretType(anchorBlock, focusBlock, isCollapsed);
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

        this.setSelection(
            { offset: 0, block: aBlock, path: aBlock.path },
            { offset: fBlock.text.length, block: fBlock, path: fBlock.path },
        );
        const activeEle = this._doc.activeElement;
        if (isHTMLElement(activeEle) && activeEle.classList.contains('mu-content'))
            activeEle.blur();
    }

    getSelection(): ISelection | null {
        const selection = this._doc.getSelection();

        if (!selection || selection.rangeCount === 0 || !this._muya.domNode.isConnected)
            return null;

        const { anchorNode, anchorOffset, focusNode, focusOffset } = selection;

        if (!anchorNode || !focusNode)
            return null;

        if (!this._muya.domNode.contains(anchorNode) || !this._muya.domNode.contains(focusNode))
            return null;

        const range = selection.getRangeAt(0);
        const anchorIsStart = range.startContainer === anchorNode && range.startOffset === anchorOffset;
        const focusIsStart = selection.isCollapsed || !anchorIsStart;
        const anchorPoint = getContentPoint(anchorNode, anchorOffset, anchorIsStart);
        const focusPoint = getContentPoint(focusNode, focusOffset, focusIsStart);
        if (!anchorPoint || !focusPoint)
            return null;

        const anchorDomNode = anchorPoint.paragraph;
        const focusDomNode = focusPoint.paragraph;
        const anchorBlock = anchorDomNode[BLOCK_DOM_PROPERTY] as Content | undefined;
        const focusBlock = focusDomNode[BLOCK_DOM_PROPERTY] as Content | undefined;
        // An `mu-content` span cloned by the browser's native edit
        // behavior is not linked back to a block. Bail out instead of
        // crashing — the caller treats null the same as "no selection".
        if (!anchorBlock || !focusBlock || anchorBlock.muya !== this._muya || focusBlock.muya !== this._muya)
            return null;

        if (!anchorBlock.outMostBlock || !focusBlock.outMostBlock)
            return null;

        const anchorPath = anchorBlock.path;
        const focusPath = focusBlock.path;

        const aOffset = getSourceOffset(anchorPoint.node, anchorPoint.offset, anchorDomNode, anchorIsStart);
        const fOffset = getSourceOffset(focusPoint.node, focusPoint.offset, focusDomNode, focusIsStart);
        const anchor = { offset: aOffset };
        const focus = { offset: fOffset };

        const isCollapsed = anchorBlock === focusBlock && anchor.offset === focus.offset;
        const isSelectionInSameBlock = anchorBlock === focusBlock;

        const direction = isCollapsed
            ? SelectionDirection.NONE
            : computeDirection(anchorBlock, focusBlock, anchor.offset, focus.offset, isSelectionInSameBlock);
        const type = computeCaretType(anchorBlock, focusBlock, isCollapsed);

        return {
            anchor: { offset: anchor.offset, block: anchorBlock, path: anchorPath },
            focus: { offset: focus.offset, block: focusBlock, path: focusPath },
            isCollapsed,
            isSelectionInSameBlock,
            direction,
            type,
        };
    }

    getSelectedText(): string {
        const selection = this._isComposing ? null : this.getSelection();
        if (!selection || selection.isCollapsed)
            return '';

        const { anchor, focus, direction } = selection;
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
        return '';
    }

    setSelection(anchor: IAnchorFocusInfo, focus: IAnchorFocusInfo) {
        this.anchor = { offset: anchor.offset };
        this.anchorBlock = anchor.block;
        this.anchorPath = anchor.path;
        this.focus = { offset: focus.offset };
        this.focusBlock = focus.block;
        this.focusPath = focus.path;
        this._updateSelection();
        this._emitSelectionChange();
    }

    private _emitSelectionChange(live?: ISelection | null) {
        if (live === undefined) {
            live = this.anchor && this.focus && this.anchorBlock && this.focusBlock
                ? {
                        anchor: { ...this.anchor, block: this.anchorBlock, path: this.anchorPath },
                        focus: { ...this.focus, block: this.focusBlock, path: this.focusPath },
                        isCollapsed: this._isCollapsed,
                        isSelectionInSameBlock: this.isSelectionInSameBlock,
                        direction: this._direction,
                        type: this._type,
                    }
                : null;
        }
        this._lastReportedSelection = live;
        const { anchor, focus, isCollapsed, isSelectionInSameBlock, direction, type } = live
            ?? {
                anchor: null,
                focus: null,
                isCollapsed: true,
                isSelectionInSameBlock: false,
                direction: SelectionDirection.NONE,
                type: SelectionCaretType.NONE,
            };
        const anchorBlock = anchor ? anchor.block : null;
        const focusBlock = focus ? focus.block : null;

        // Follow the caret (focus end) for forward selections so typewriter
        // scrolling tracks the cursor rather than the selection start.
        const cursorCoords = live === null ? null : getCursorCoords(direction === SelectionDirection.FORWARD);
        // Duck-type the Format block — a value import of Format here would
        // create a selection -> format circular dependency.
        const anchorBlockRef = anchorBlock as Format | null;
        const formats
            = isSelectionInSameBlock
                && anchorBlockRef
                && typeof anchorBlockRef.getFormatsInRange === 'function'
                ? anchorBlockRef.getFormatsInRange().formats
                : [];

        const affiliation = buildSelectionAffiliation(anchorBlock, focusBlock);

        this._muya.eventCenter.emit('selection-change', {
            anchor: anchor ? { offset: anchor.offset } : null,
            focus: focus ? { offset: focus.offset } : null,
            anchorBlock,
            anchorPath: anchor ? anchor.path : [],
            focusBlock,
            focusPath: focus ? focus.path : [],
            isCollapsed,
            isSelectionInSameBlock,
            direction,
            type,
            kind: SelectionType.TEXT,
            selectedImage: this._selection.image,
            cursorCoords,
            formats,
            affiliation,
            anchorBlockInfo: endpointBlockInfo(anchorBlock),
            focusBlockInfo: endpointBlockInfo(focusBlock),
        });
    }

    private _listenSelectActions() {
        const { eventCenter, domNode } = this._muya;

        const handleSelectionChange = () => {
            if (this._isComposing || this._selection.type !== SelectionType.TEXT)
                return;

            const current = this.getSelection();
            const previous = this._lastReportedSelection;
            if (!current && !previous)
                return;
            if (current && previous
                && current.anchor.block === previous.anchor.block
                && current.focus.block === previous.focus.block
                && current.anchor.offset === previous.anchor.offset
                && current.focus.offset === previous.focus.offset) {
                return;
            }

            // Report the live range without committing it through setSelection:
            // rewriting the DOM here would interrupt native dragging, and the
            // block keyup handlers still need the previous committed cursor.
            this._emitSelectionChange(current);
        };

        const handleMousedown = () => {
            this._selectInfo = {
                isSelect: true,
                selection: null,
            };
        };

        const handleMouseupOrLeave = () => {
            const { selection } = this._selectInfo;
            if (selection?.anchor.block.outMostBlock && selection.focus.block.outMostBlock)
                this.setSelection(selection.anchor, selection.focus);

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

            const { anchor, focus, isSelectionInSameBlock } = selection;

            if (isSelectionInSameBlock) {
                return;
            }

            const anchorBlock = anchor.block;
            const focusBlock = focus.block;
            const endpointAnchor = { offset: anchor.offset, block: anchorBlock, path: anchorBlock.path };
            const endpointFocus = { offset: focus.offset, block: focusBlock, path: focusBlock.path };

            if (type === 'mousemove')
                this._selectInfo.selection = { anchor: endpointAnchor, focus: endpointFocus };
            else
                this.setSelection(endpointAnchor, endpointFocus);
        };

        eventCenter.attachDOMEvent(domNode, 'mousedown', handleMousedown);
        eventCenter.attachDOMEvent(domNode, 'mousemove', handleMousemoveOrClick);
        eventCenter.attachDOMEvent(domNode, 'mouseup', handleMouseupOrLeave);
        eventCenter.attachDOMEvent(domNode, 'mouseleave', handleMouseupOrLeave);
        eventCenter.attachDOMEvent(domNode, 'click', handleMousemoveOrClick);
        // Preedit DOM offsets do not refer to the committed block text yet.
        // The block's compositionend handler commits text and emits its cursor.
        eventCenter.attachDOMEvent(domNode, 'compositionstart', () => {
            this._isComposing = true;
        });
        eventCenter.attachDOMEvent(domNode, 'compositionend', () => {
            this._isComposing = false;
        });
        eventCenter.attachDOMEvent(this._doc, 'selectionchange', handleSelectionChange);
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
