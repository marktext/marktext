import type Content from '../block/base/content';
import type Format from '../block/base/format';
import type { Muya } from '../muya';
import type { IAnchorFocusInfo, ITextSelectionState } from '../selection/types';
import { isOsx } from '../config';
import { findContentDOM, resolveEndpoint } from '../selection/dom';
import { createTextSelectionState } from '../selection/state';
import { SelectionType } from '../selection/types';
import { atxHeadingBodyRange } from '../state/headings';
import './dragDropText.css';

const TEXT_BLOCKS = new Set([
    'paragraph.content',
    'atxheading.content',
    'setextheading.content',
    'table.cell.content',
    'codeblock.content',
]);

export interface ITextDragSource {
    block: Content;
    start: number;
    end: number;
    original: string;
    selection: ITextSelectionState;
}

function validOffset(block: Content, offset: number): boolean {
    if (!TEXT_BLOCKS.has(block.blockName) || !Number.isInteger(offset) || offset < 0 || offset > block.text.length)
        return false;
    const previous = block.text.charCodeAt(offset - 1);
    const next = block.text.charCodeAt(offset);
    if (previous >= 0xD800 && previous <= 0xDBFF && next >= 0xDC00 && next <= 0xDFFF)
        return false;
    return true;
}

export function getTextDragSource(muya: Muya): ITextDragSource | null {
    const selection = muya.getSelection();
    if (muya.isReadOnly || muya.editor.isComposing || selection?.kind !== SelectionType.TEXT)
        return null;
    const { anchorBlock: block, isSelectionInSameBlock, isCollapsed } = selection.context;
    const start = Math.min(selection.anchor.offset, selection.focus.offset);
    const end = Math.max(selection.anchor.offset, selection.focus.offset);
    if (!isSelectionInSameBlock || isCollapsed || !validOffset(block, start) || !validOffset(block, end))
        return null;
    return {
        block,
        start,
        end,
        original: block.text,
        selection: createTextSelectionState(
            { block, offset: selection.anchor.offset, path: block.path },
            { block, offset: selection.focus.offset, path: block.path },
        ),
    };
}

export function canDropText(muya: Muya, source: ITextDragSource, target: IAnchorFocusInfo, copy: boolean): boolean {
    if (muya.isReadOnly || muya.editor.isComposing || source.block.text !== source.original)
        return false;
    if (!muya.isBlockInDocument(source.block) || !muya.isBlockInDocument(target.block) || !validOffset(target.block, target.offset))
        return false;
    if (target.block.blockName === 'atxheading.content') {
        const body = atxHeadingBodyRange(target.block.text);
        if (target.offset < body.start || target.offset > body.end)
            return false;
    }
    if (target.block === source.block) {
        return copy
            ? target.offset <= source.start || target.offset >= source.end
            : target.offset < source.start || target.offset > source.end;
    }
    return true;
}

function contentBlocks(muya: Muya): Content[] {
    const blocks: Content[] = [];
    let block = muya.editor.scrollPage!.firstContentInDescendant();
    while (block) {
        blocks.push(block);
        block = block.nextContentInContext() ?? null;
    }
    return blocks;
}

function bookmarkTarget(muya: Muya, source: Content, target: Content): () => Content {
    const blocks = contentBlocks(muya);
    const index = blocks.indexOf(target);
    const beforeSource = index < blocks.indexOf(source);
    const distanceFromEnd = blocks.length - index;
    const text = target.text;

    return () => {
        if (muya.isBlockInDocument(target))
            return target;
        // Conversions may split the source and rebuild its siblings, but retain
        // other leaves in order. Count from the end that does not cross the source.
        const current = contentBlocks(muya);
        const resolved = current[beforeSource ? index : current.length - distanceFromEnd];
        if (!resolved || resolved.text !== text || resolved.blockName !== target.blockName)
            throw new Error('Text drag destination lost during source conversion');
        return resolved;
    };
}

export function dropText(muya: Muya, source: ITextDragSource, target: IAnchorFocusInfo, copy: boolean): void {
    if (!canDropText(muya, source, target, copy))
        return;
    const { block, start, end, original } = source;
    const raw = original.slice(start, end);
    const text = ['atxheading.content', 'table.cell.content'].includes(target.block.blockName)
        ? raw.replace(/\r\n|[\r\n]/g, '<br>')
        : raw;
    const offset = target.offset - (!copy && target.block === block && target.offset > end ? end - start : 0);

    muya.editor.transact(() => {
        let destination = target.block;
        if (!copy) {
            block.text = original.slice(0, start) + original.slice(end);
            block.update();
        }
        // Conversion handlers require a local cursor, even for the leaf losing the text.
        if (!copy && block !== destination && block.blockName !== 'codeblock.content') {
            const resolveTarget = bookmarkTarget(muya, block, destination);
            block.setCursor(start, start, true);
            (block as Format).checkInlineUpdate();
            destination = resolveTarget();
        }
        destination.text = destination.text.slice(0, offset) + text + destination.text.slice(offset);
        destination.setCursor(offset, offset + text.length, true);
        if (destination.blockName !== 'codeblock.content')
            (destination as Format).checkInlineUpdate();
    }, true, source.selection);
}

interface IPointTarget {
    endpoint: IAnchorFocusInfo;
    rect: DOMRect;
}

function targetAt(muya: Muya, x: number, y: number): IPointTarget | null {
    const doc = muya.domNode.ownerDocument;
    const hit = doc.elementFromPoint(x, y);
    if (hit?.closest('img, input, textarea, button, [contenteditable="false"], .mu-math-render, .mu-ruby-render'))
        return null;
    const content = findContentDOM(hit);
    if (!content || !muya.domNode.contains(content))
        return null;
    const caret = doc.caretPositionFromPoint?.(x, y);
    const range = doc.createRange();
    if (caret) {
        range.setStart(caret.offsetNode, caret.offset);
        range.collapse(true);
    }
    else {
        const fallback = doc.caretRangeFromPoint?.(x, y);
        if (!fallback)
            return null;
        range.setStart(fallback.startContainer, fallback.startOffset);
        range.collapse(true);
    }
    const endpoint = resolveEndpoint(range.startContainer, range.startOffset);
    if (!endpoint || endpoint.block.domNode !== content)
        return null;
    const rect = range.getClientRects()[0] ?? content.getBoundingClientRect();
    return { endpoint, rect };
}

export class TextDrag {
    private _source: ITextDragSource | null = null;
    private _origin = { x: 0, y: 0 };
    private _point = { x: 0, y: 0 };
    private _dragging = false;
    private _suppressClick = false;
    private _copy = false;
    private _cursor = '';
    private _scroll = { top: 0, left: 0 };
    private _preview: HTMLElement | null = null;
    private _indicator: HTMLElement | null = null;

    constructor(private _muya: Muya) {
        const { eventCenter, domNode } = _muya;
        const doc = domNode.ownerDocument;
        const attach = (target: HTMLElement | Document, name: string, handler: EventListener) => {
            eventCenter.attachDOMEvent(target, name, handler, true);
        };
        attach(doc, 'mousedown', this._down);
        attach(doc, 'mousemove', this._move);
        attach(doc, 'mouseup', this._up);
        attach(doc, 'keydown', this._key);
        attach(doc, 'keyup', this._key);
        attach(doc, 'blur', this._blur);
        attach(domNode, 'scroll', () => this._restoreScroll());
        doc.defaultView?.addEventListener('blur', this._blur);
        attach(doc, 'click', (event) => {
            if (this._suppressClick) {
                this._suppressClick = false;
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        });
        attach(domNode, 'dragstart', (event) => {
            // Native text drops bypass transactions and may also scroll the editor.
            if (findContentDOM(event.target as Node))
                event.preventDefault();
        });
        eventCenter.on('read-only-changed', () => this.cancel());
        eventCenter.on('json-change', () => this.cancel(false));
    }

    get isDragging(): boolean {
        return this._dragging;
    }

    destroy(): void {
        this.cancel(false);
        this._muya.domNode.ownerDocument.defaultView?.removeEventListener('blur', this._blur);
    }

    private _blur = () => this.cancel();

    cancel(restore = true): void {
        const source = this._source;
        if (!source)
            return;
        this._source = null;
        this._dragging = false;
        this._preview?.remove();
        this._indicator?.remove();
        this._preview = this._indicator = null;
        delete this._muya.domNode.dataset.textDragging;
        this._muya.domNode.style.cursor = this._cursor;
        if (restore && source && source.block.text === source.original && this._muya.isBlockInDocument(source.block))
            this._muya.setSelection(source.selection);
    }

    private _down = (event: Event) => {
        this._suppressClick = false;
        this.cancel(false);
        if (!(event instanceof MouseEvent) || event.button !== 0 || event.detail > 1 || event.shiftKey)
            return;
        if (!(event.target instanceof Node) || !this._muya.domNode.contains(event.target))
            return;
        const source = getTextDragSource(this._muya);
        const native = document.getSelection();
        if (!source || !native?.rangeCount)
            return;
        const inside = [...native.getRangeAt(0).getClientRects()].some(rect =>
            event.clientX >= rect.left && event.clientX <= rect.right
            && event.clientY >= rect.top && event.clientY <= rect.bottom,
        );
        if (!inside || findContentDOM(event.target) !== source.block.domNode)
            return;
        event.preventDefault();
        event.stopImmediatePropagation();
        this._scroll = { top: this._muya.domNode.scrollTop, left: this._muya.domNode.scrollLeft };
        this._muya.flush();
        this._source = source;
        this._restoreScroll();
        this._origin = this._point = { x: event.clientX, y: event.clientY };
        this._cursor = this._muya.domNode.style.cursor;
    };

    // Native mouse-drag sources can omit buttons; the captured down/up events own the gesture.
    private _move = (event: Event) => {
        if (!this._source || !(event instanceof MouseEvent))
            return;
        event.preventDefault();
        event.stopImmediatePropagation();
        this._point = { x: event.clientX, y: event.clientY };
        this._copy = isOsx ? event.altKey : event.ctrlKey;
        if (!this._dragging && Math.hypot(event.clientX - this._origin.x, event.clientY - this._origin.y) < 4)
            return;
        if (!this._dragging) {
            this._dragging = true;
            this._muya.domNode.dataset.textDragging = 'true';
            this._muya.hideAllFloatTools();
            this._preview = this._overlay('mu-text-drag-preview');
            this._preview.textContent = this._source.original.slice(this._source.start, this._source.end).slice(0, 100);
            this._indicator = this._overlay('mu-text-drop-caret');
        }
        this._paint();
    };

    private _key = (event: Event) => {
        if (!this._source || !(event instanceof KeyboardEvent))
            return;
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopImmediatePropagation();
            this._suppressClick = true;
            this.cancel();
            return;
        }
        this._copy = isOsx ? event.altKey : event.ctrlKey;
        if (this._dragging)
            this._paint();
    };

    private _up = (event: Event) => {
        if (!this._source || !(event instanceof MouseEvent) || event.button !== 0)
            return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const source = this._source;
        this._restoreScroll();
        const target = targetAt(this._muya, event.clientX, event.clientY);
        const copy = isOsx ? event.altKey : event.ctrlKey;
        const dragging = this._dragging;
        this._suppressClick = dragging;
        this.cancel();
        if (dragging && target)
            dropText(this._muya, source, target.endpoint, copy);
        else if (!dragging && target)
            target.endpoint.block.setCursor(target.endpoint.offset, target.endpoint.offset, true);
    };

    private _overlay(className: string): HTMLElement {
        const element = document.createElement('div');
        element.className = className;
        element.contentEditable = 'false';
        element.setAttribute('aria-hidden', 'true');
        this._muya.domNode.appendChild(element);
        return element;
    }

    // Host caret-follow animations must not move the document under a captured drop point.
    private _restoreScroll(): void {
        if (!this._source)
            return;
        const root = this._muya.domNode;
        if (root.scrollTop !== this._scroll.top)
            root.scrollTop = this._scroll.top;
        if (root.scrollLeft !== this._scroll.left)
            root.scrollLeft = this._scroll.left;
    }

    private _paint(): void {
        if (!this._source || !this._preview || !this._indicator)
            return;
        this._restoreScroll();
        const { x, y } = this._point;
        const target = targetAt(this._muya, x, y);
        const allowed = target && canDropText(this._muya, this._source, target.endpoint, this._copy);
        this._muya.domNode.style.cursor = allowed ? (this._copy ? 'copy' : 'grabbing') : 'not-allowed';
        this._preview.dataset.operation = this._copy ? 'copy' : 'move';
        this._preview.style.left = `${x + 14}px`;
        this._preview.style.top = `${y + 14}px`;
        this._indicator.hidden = !allowed;
        if (allowed) {
            this._indicator.style.left = `${target.rect.left}px`;
            this._indicator.style.top = `${target.rect.top}px`;
            this._indicator.style.height = `${Math.max(target.rect.height, 16)}px`;
        }
    }
}
