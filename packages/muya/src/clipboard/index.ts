import type { Muya } from '../muya';
import type { Nullable } from '../types';
import type { IClipboardPayload } from './copyData';
import Format from '../block/base/format';
import { classifyInputKind } from '../history';
import { isClipboardEvent, isInputEvent, isKeyboardEvent } from '../utils';
import { getClipboardData, writeClipboardData } from './copyData';
import { cutSelection, deleteTableSelection, insertTextAtCursor } from './cut';
import { pastePlainText, pasteSelection } from './paste';
import { pasteImageSrc } from './pasteImage';
import { CopyType, PasteType } from './types';

// Modifier shortcuts such as Ctrl+C must never delete a cross-block selection (#3491).
export function shouldCrossBlockCut(key: string, metaKey: boolean, ctrlKey: boolean): boolean {
    if (/Alt|Option|Meta|Shift|CapsLock|ArrowUp|ArrowDown|ArrowLeft|ArrowRight/.test(key))
        return false;

    if (metaKey || ctrlKey)
        return false;

    return true;
}

const FOREIGN_INPUT_TYPES = new Set([
    'deleteByCut',
    'deleteByDrag',
    'deleteCompositionText',
    'insertCompositionText',
    'insertFromDrop',
    'insertFromPaste',
    'insertFromPasteAsQuotation',
    'insertLineBreak',
    'insertParagraph',
]);

export function crossBlockReplacement(inputType: string, data: Nullable<string>): Nullable<string> {
    if (FOREIGN_INPUT_TYPES.has(inputType))
        return null;

    switch (classifyInputKind(inputType)) {
        case 'delete':
            return '';
        case 'insert':
            return data ?? '';
        default:
            return null;
    }
}

class Clipboard {
    public copyType: CopyType = CopyType.NORMAL;
    public pasteType: PasteType = PasteType.NORMAL;
    public copyInfo: string = '';

    get selection() {
        return this.muya.editor.selection;
    }

    get scrollPage() {
        return this.muya.editor.scrollPage;
    }

    static create(muya: Muya) {
        const clipboard = new Clipboard(muya);
        clipboard._listen();

        return clipboard;
    }

    constructor(public muya: Muya) {}

    private _listen() {
        const ownsEvent = () => {
            if (this.muya.hasFocus())
                return true;
            return this.muya.isReadOnly
                && !document.activeElement?.matches('input, textarea, [contenteditable="true"]')
                && this.muya.domNode.contains(document.getSelection()?.anchorNode ?? null);
        };

        const copyCutHandler = (event: Event) => {
            if (!ownsEvent() || !isClipboardEvent(event))
                return;
            event.preventDefault();
            event.stopPropagation();

            const isCut = event.type === 'cut';
            if (isCut && this.muya.isReadOnly)
                return;

            this.copyHandler(event);

            if (isCut)
                this.cutHandler();
        };

        const keydownHandler = (event: Event) => {
            if (this.muya.isReadOnly)
                return;
            if (!ownsEvent() || !isKeyboardEvent(event))
                return;
            const { key, metaKey } = event;

            if (this.selection.table.hasSelection) {
                if (!metaKey && (key === 'Backspace' || key === 'Delete')) {
                    event.preventDefault();
                    deleteTableSelection(this);
                }
                return;
            }

            const { isSelectionInSameBlock } = this.selection.getSelection() ?? {};
            if (isSelectionInSameBlock)
                return;

            if (!shouldCrossBlockCut(key, metaKey, event.ctrlKey))
                return;

            // Enter over a cross-block selection: suppress the corrupting native
            // Enter and mirror the same-block path — delete then split (#2443).
            if (key === 'Enter') {
                event.preventDefault();
                this.cutHandler();
                const block = this.muya.editor.activeContentBlock;
                if (!event.shiftKey && block instanceof Format)
                    block.enterHandler(event);
                return;
            }

            if (key === 'Backspace' || key === 'Delete')
                event.preventDefault();

            this.cutHandler();
        };

        const beforeInputHandler = (event: Event) => {
            if (this.muya.isReadOnly)
                return;
            if (!ownsEvent() || !isInputEvent(event) || !event.cancelable)
                return;

            const replacement = crossBlockReplacement(event.inputType, event.data);
            if (replacement == null || document.getSelection()?.isCollapsed !== false)
                return;

            if (this.selection.getSelection()?.isSelectionInSameBlock !== false)
                return;

            event.preventDefault();
            this.cutHandler();

            if (replacement)
                insertTextAtCursor(this, replacement);
        };

        const pasteHandler = (event: Event) => {
            if (ownsEvent() && isClipboardEvent(event))
                this.pasteHandler(event);
        };

        const { eventCenter } = this.muya;

        eventCenter.attachDOMEvent(document, 'copy', copyCutHandler);
        eventCenter.attachDOMEvent(document, 'cut', copyCutHandler);
        eventCenter.attachDOMEvent(document, 'paste', pasteHandler);
        eventCenter.attachDOMEvent(document, 'keydown', keydownHandler);
        eventCenter.attachDOMEvent(document, 'beforeinput', beforeInputHandler);
    }

    getClipboardData(): IClipboardPayload {
        return getClipboardData(this);
    }

    copyHandler(event: ClipboardEvent): void {
        writeClipboardData(this, event);
    }

    cutHandler(): void {
        if (!this.muya.canMutate)
            return;
        cutSelection(this);
    }

    pasteHandler(
        event: ClipboardEvent,
        rawText?: string,
        rawHtml?: string,
    ): Promise<void> {
        if (!this.muya.canMutate)
            return Promise.resolve();
        return pasteSelection(this, event, rawText, rawHtml);
    }

    copyAsMarkdown() {
        this.copyType = CopyType.COPY_AS_MARKDOWN;
        document.execCommand('copy');
        this.copyType = CopyType.NORMAL;
    }

    copyAsHtml() {
        this.copyType = CopyType.COPY_AS_HTML;
        document.execCommand('copy');
        this.copyType = CopyType.NORMAL;
    }

    copyAsRich() {
        this.copyType = CopyType.COPY_AS_RICH;
        document.execCommand('copy');
        this.copyType = CopyType.NORMAL;
    }

    // Read explicitly: Chromium no longer dispatches paste for execCommand('paste').
    async pasteAsPlainText(): Promise<void> {
        const target = this.selection.getSelection()?.anchor.block;
        const text = await this._readClipboardText();
        if (this.muya.isReadOnly || !this.muya.isBlockInDocument(target) || this.selection.getSelection()?.anchor.block !== target)
            return;
        if (text)
            await pastePlainText(this, text);
    }

    pasteImage(src: string): Promise<void> {
        return pasteImageSrc(this, src);
    }

    private async _readClipboardText(): Promise<string> {
        // Sandboxed hosts supply a clipboard bridge; standalone browsers use the Clipboard API.
        const reader = this.muya.options.clipboardText;
        if (typeof reader === 'function') {
            try {
                return await reader();
            }
            catch {
                return '';
            }
        }

        if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
            try {
                return await navigator.clipboard.readText();
            }
            catch {
                return '';
            }
        }

        return '';
    }

    copy(type: CopyType, info: string) {
        this.copyType = type;
        this.copyInfo = info;
        document.execCommand('copy');
        this.copyType = CopyType.NORMAL;
    }
}

export default Clipboard;
