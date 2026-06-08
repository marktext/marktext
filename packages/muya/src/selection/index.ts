import type Content from '../block/base/content';
import type Format from '../block/base/format';
import type Parent from '../block/base/parent';
import type ListItem from '../block/commonMark/listItem';
import type TaskListItem from '../block/gfm/taskListItem';
import type { ImageToken } from '../inlineRenderer/types';
import type { Muya } from '../muya';
import type { ICursor, INodeOffset, ISelection } from './types';
import { BLOCK_DOM_PROPERTY, CLASS_NAMES } from '../config';
import { isElement, isHTMLElement, isKeyboardEvent, isMouseEvent } from '../utils';
import { getImageInfo, getImageSrc } from '../utils/image';
import {
    compareParagraphsOrder,
    findContentDOM,
    getNodeAndOffset,
    getOffsetOfParagraph,
} from './dom';
import { shouldShowImageResizeBar } from './imageDisplay';

class Selection {
    /**
     * topOffset is the line counts above cursor, and bottomOffset is line counts bellow cursor.
     * @param {*} paragraph
     */
    static getCursorYOffset(paragraph: HTMLElement) {
        const { y } = this.getCursorCoords()!;
        const { height, top } = paragraph.getBoundingClientRect();
        const lineHeight = Number.parseFloat(getComputedStyle(paragraph).lineHeight);
        const topOffset = Math.floor((y - top) / lineHeight);
        const bottomOffset = Math.round(
            (top + height - lineHeight - y) / lineHeight,
        );

        return {
            topOffset,
            bottomOffset,
        };
    }

    static getCursorCoords(preferEnd = false) {
        const sel = document.getSelection();
        let range;
        let rect = null;

        if (sel?.rangeCount) {
            range = sel.getRangeAt(0).cloneRange();
            if (range.getClientRects) {
                // range.collapse(true)
                let rects: DOMRectList | null = range.getClientRects();
                if (rects.length === 0) {
                    rects
                        = range.startContainer && isElement(range.startContainer)
                            ? range.startContainer.getClientRects()
                            : null;
                }

                // For a forward range selection the caret sits at the END, so
                // prefer the last client rect; otherwise the first rect is the
                // caret (collapsed cursor or backward selection).
                if (rects?.length)
                    rect = preferEnd ? rects[rects.length - 1] : rects[0];
            }
        }

        return rect;
    }

    // https://stackoverflow.com/questions/1197401/
    // how-can-i-get-the-element-the-caret-is-in-with-javascript-when-using-contenteditable
    // by You
    static getSelectionStart() {
        const node = document.getSelection()!.anchorNode;
        const startNode
            = node && node.nodeType === Node.TEXT_NODE ? node.parentNode : node;

        return startNode;
    }

    get scrollPage() {
        return this.muya.editor.scrollPage;
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

    public doc: Document = document;
    public anchorPath: (string | number)[] = [];
    public anchorBlock: Content | null = null;
    public focusPath: (string | number)[] = [];
    public focusBlock: Content | null = null;
    public anchor: INodeOffset | null = null;
    public focus: INodeOffset | null = null;
    public selectedImage: {
        token: ImageToken;
        imageId: string;
        block: Format;
    } | null = null;

    private _selectInfo: {
        isSelect: boolean;
        selection: ICursor | null;
    } = {
        isSelect: false,
        selection: null,
    };

    constructor(public muya: Muya) {
        this._listenSelectActions();
    }

    selectAll() {
        const {
            anchor,
            focus,
            isSelectionInSameBlock,
            anchorBlock,
            anchorPath,
            scrollPage,
        } = this;
        // Select all in one content block.
        // Can use getSelection here?
        if (
            isSelectionInSameBlock
            && anchor
            && focus
            && anchorBlock
            && Math.abs(focus.offset - anchor.offset) < anchorBlock.text.length
        ) {
            const cursor: ICursor = {
                anchor: { offset: 0 },
                focus: { offset: anchorBlock.text.length },
                block: anchorBlock,
                path: anchorPath,
            };

            this.setSelection(cursor);
            return;
        }
        // Select all content in all blocks.
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

    /**
     * Return the current selection of doc or null if has no selection.
     * @returns The resolved selection mapped to anchor/focus blocks, or null when no selection exists.
     */
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
        let direction = 'none';
        let type = 'None';

        if (isCollapsed)
            direction = 'none';

        if (isSelectionInSameBlock) {
            direction = anchor.offset < focus.offset ? 'forward' : 'backward';
        }
        else {
            const aDom = anchorBlock.domNode!;
            const fDom = focusBlock.domNode!;
            const order = compareParagraphsOrder(aDom, fDom);
            direction = order ? 'forward' : 'backward';
        }

        type = isCollapsed ? 'Caret' : 'Range';

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
        // Update cursor.
        this._setCursor();

        const {
            isCollapsed,
            isSelectionInSameBlock,
            direction,
            type,
            selectedImage,
        } = this;

        // Backport of marktext's `selectionChange` payload extras the desktop
        // relies on: `cursorCoords` for typewriter-mode scrolling and the
        // active inline formats at the cursor for lighting up the toolbar.
        // Follow the caret (focus end) for forward selections so typewriter
        // scrolling tracks the cursor rather than the selection start.
        const cursorCoords = Selection.getCursorCoords(direction === 'forward');
        // Duck-type the Format block — a value import of Format here would
        // create a selection -> format circular dependency.
        const anchorBlockRef = this.anchorBlock as Format | null;
        const formats
            = isSelectionInSameBlock
                && anchorBlockRef
                && typeof anchorBlockRef.getFormatsInRange === 'function'
                ? anchorBlockRef.getFormatsInRange().formats
                : [];

        this.muya.eventCenter.emit('selection-change', {
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
            selectedImage,
            cursorCoords,
            formats,
        });
    }

    private _listenSelectActions() {
        const { eventCenter, domNode } = this.muya;

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
            // The cursor is not in editor
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
                // No need to handle this case
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

        const docHandlerClick = () => {
            this.selectedImage = null;
        };

        const handleClick = (event: Event) => {
            const { target } = event;
            if (!isHTMLElement(target))
                return;
            const imageWrapper = target.closest<HTMLElement>(`.${CLASS_NAMES.MU_INLINE_IMAGE}`);
            this.selectedImage = null;
            if (imageWrapper)
                return this._handleClickInlineImage(event, imageWrapper);
        };

        const handleKeydown = (event: Event) => {
            if (!isKeyboardEvent(event))
                return;

            const { key } = event;
            const { selectedImage } = this;
            // marktext ed1b3354 (#2816): `Delete` was missing from the
            // image-selected key set, so it fell through to native
            // contenteditable handling and removed the text *after* the
            // image. Match key exactly to avoid substring-collisions
            // like `BackspaceX`.
            if (selectedImage && /^(?:Backspace|Delete|Enter)$/.test(key)) {
                event.preventDefault();
                const { block, ...imageInfo } = selectedImage;
                block.deleteImage(imageInfo);
                this.selectedImage = null;
            }
        };

        eventCenter.attachDOMEvent(domNode, 'mousedown', handleMousedown);
        eventCenter.attachDOMEvent(domNode, 'mousemove', handleMousemoveOrClick);
        eventCenter.attachDOMEvent(domNode, 'mouseup', handleMouseupOrLeave);
        eventCenter.attachDOMEvent(domNode, 'mouseleave', handleMouseupOrLeave);
        eventCenter.attachDOMEvent(domNode, 'click', handleMousemoveOrClick);
        eventCenter.attachDOMEvent(domNode, 'click', handleClick);
        eventCenter.attachDOMEvent(document, 'click', docHandlerClick);
        eventCenter.attachDOMEvent(document, 'keydown', handleKeydown);
    }

    // Handle click inline image.
    private _handleClickInlineImage(event: Event, imageWrapper: HTMLElement) {
        event.preventDefault();
        event.stopPropagation();
        const { eventCenter } = this.muya;
        const imageInfo = getImageInfo(imageWrapper);
        const { target } = event;
        if (!(target instanceof Node))
            return;
        const deleteContainer = isHTMLElement(target)
            ? target.closest('.mu-image-icon-close')
            : null;
        const contentDom = findContentDOM(target);

        if (!contentDom)
            return;

        const contentBlock = contentDom[BLOCK_DOM_PROPERTY] as Format;

        if (deleteContainer) {
            contentBlock.deleteImage(imageInfo);

            return;
        }

        // Handle image click, to select the current image
        if (isHTMLElement(target) && target.tagName === 'IMG') {
            // Cmd/Ctrl-click an image → ask the host to preview it. marktext's
            // `clickEvent.js` dispatched `format-click` with `{ event,
            // formatType: 'image', data: <src> }`; the desktop renderer
            // (`editor.vue` `format-click` handler) gates on the modifier and
            // opens a `SimpleImageViewer` with that src string. We resolve the
            // src from the token (the same source path the renderer used)
            // through `getImageSrc` so relative/file paths become loadable
            // URLs, falling back to the rendered <img>'s own `src` attribute.
            // The plain-click select/toolbar/transformer path below is left
            // untouched.
            if (event instanceof MouseEvent && (event.metaKey || event.ctrlKey)) {
                const tokenSrc = imageInfo.token.src || imageInfo.token.attrs.src || '';
                const src = getImageSrc(tokenSrc).src || target.getAttribute('src') || '';
                if (src) {
                    eventCenter.emit('format-click', {
                        event,
                        formatType: 'image',
                        data: src,
                    });
                }
            }

            // Handle show image toolbar
            const rect = imageWrapper
                .querySelector(`.${CLASS_NAMES.MU_IMAGE_CONTAINER}`)
                ?.getBoundingClientRect();
            const reference = {
                getBoundingClientRect: () => rect,
                width: imageWrapper.offsetWidth,
                height: imageWrapper.offsetHeight,
            };

            // Show image edit tool bar.
            eventCenter.emit('muya-image-toolbar', {
                block: contentBlock,
                reference,
                imageInfo,
            });

            // Handle show image transformer.
            // marktext d26f5092 (#1335): the resize bar should only appear for
            // block-aligned images. Inline images flow with surrounding text
            // and dragging their edges has no meaningful resize semantics.
            if (shouldShowImageResizeBar(imageInfo.token)) {
                const imageSelector = `#${imageInfo.imageId}`;

                const imageContainer = document.querySelector(
                    `${imageSelector} .${CLASS_NAMES.MU_IMAGE_CONTAINER}`,
                );

                eventCenter.emit('muya-transformer', {
                    block: contentBlock,
                    reference: imageContainer,
                    imageInfo,
                });
            }
            else {
                eventCenter.emit('muya-transformer', { reference: null });
            }

            this.selectedImage = Object.assign({}, imageInfo, {
                block: contentBlock,
            });
            this.muya.editor.activeContentBlock = null;
            this.setSelection({
                anchor: null,
                focus: null,
            });

            return;
        }

        // Handle click imageWrapper when it's empty or image load failed.
        if (
            imageWrapper.classList.contains(CLASS_NAMES.MU_EMPTY_IMAGE)
            || imageWrapper.classList.contains(CLASS_NAMES.MU_IMAGE_FAIL)
        ) {
            const rect = imageWrapper.getBoundingClientRect();
            const reference = {
                getBoundingClientRect: () => rect,
                width: imageWrapper.offsetWidth,
                height: imageWrapper.offsetHeight,
            };
            const imageInfo = getImageInfo(imageWrapper);
            eventCenter.emit('muya-image-selector', {
                block: contentBlock,
                reference,
                imageInfo,
            });
        }
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

        // Remove the selection when type is `None`.
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
        // an actual Node here. Fixing the underlying contract (so queryBlock
        // is never reached with a block) is out of scope for this PR — early
        // return preserves the existing not-found behaviour.
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

        // First set the anchor node and anchor offset, make it collapsed
        this._select(anchorNode, anchorOffset);
        // Secondly, set the focus node and focus offset.
        this._setFocus(focusNode, focusOffset);
    }
}

export function getCursorReference() {
    const rect = Selection.getCursorCoords();

    if (!rect)
        return null;

    return {
        getBoundingClientRect() {
            return rect;
        },
        clientWidth: rect.width,
        clientHeight: rect.height,
    };
}

export default Selection;
