import type { Muya } from '../muya';
import type { IClipboardPayload } from './copyData';
import Format from '../block/base/format';
import { isClipboardEvent, isKeyboardEvent } from '../utils';
import { getClipboardData, writeClipboardData } from './copyData';
import { cutSelection, deleteTableSelection } from './cut';
import { pastePlainText, pasteSelection } from './paste';
import { pasteImageSrc } from './pasteImage';
import { CopyType, PasteType } from './types';

// After the table/same-block guards, decide whether a keydown over a
// cross-block selection should cut (replace) the selected text. Non-editing
// keys and any modifier combo must NOT cut — in particular Ctrl+<key> (e.g.
// Ctrl+C copy on Windows/Linux), which was previously not excluded and
// silently deleted the selection (#3491). Mirrors the macOS metaKey guard.
export function shouldCrossBlockCut(key: string, metaKey: boolean, ctrlKey: boolean): boolean {
    if (/Alt|Option|Meta|Shift|CapsLock|ArrowUp|ArrowDown|ArrowLeft|ArrowRight/.test(key))
        return false;

    if (metaKey || ctrlKey)
        return false;

    return true;
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
        const ownsEvent = () => this.muya.hasFocus();

        const copyCutHandler = (event: Event) => {
            if (!ownsEvent() || !isClipboardEvent(event))
                return;
            event.preventDefault();
            event.stopPropagation();

            const isCut = event.type === 'cut';

            this.copyHandler(event);

            if (isCut)
                this.cutHandler();
        };

        const keydownHandler = (event: Event) => {
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

        const pasteHandler = (event: Event) => {
            if (ownsEvent() && isClipboardEvent(event))
                this.pasteHandler(event);
        };

        const { eventCenter } = this.muya;

        eventCenter.attachDOMEvent(document, 'copy', copyCutHandler);
        eventCenter.attachDOMEvent(document, 'cut', copyCutHandler);
        eventCenter.attachDOMEvent(document, 'paste', pasteHandler);
        eventCenter.attachDOMEvent(document, 'keydown', keydownHandler);
    }

    getClipboardData(): IClipboardPayload {
        return getClipboardData(this);
    }

    copyHandler(event: ClipboardEvent): void {
        writeClipboardData(this, event);
    }

    cutHandler(): void {
        cutSelection(this);
    }

    pasteHandler(
        event: ClipboardEvent,
        rawText?: string,
        rawHtml?: string,
    ): Promise<void> {
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

    // Chromium removed programmatic clipboard reads via
    // `document.execCommand('paste')` — it returns false and fires no paste
    // event, so the old flag + execCommand approach pasted nothing. Read the
    // clipboard text ourselves and feed it through the paste pipeline.
    async pasteAsPlainText(): Promise<void> {
        const text = await this._readClipboardText();
        if (text)
            await pastePlainText(this, text);
    }

    // Insert an image at the cursor from an explicit `src` (a saved file path or
    // `data:` URL), routing through `imageAction` like a clipboard image paste.
    // Drives the macOS screenshot flow, which can no longer use the removed
    // `document.execCommand('paste')`.
    pasteImage(src: string): Promise<void> {
        return pasteImageSrc(this, src);
    }

    private async _readClipboardText(): Promise<string> {
        // Sandboxed Electron renderers can't reach the system clipboard
        // directly, so the embedder supplies a reader (e.g. an IPC bridge to
        // Electron's native `clipboard`). Fall back to the async Clipboard API
        // for standalone (browser) use.
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
