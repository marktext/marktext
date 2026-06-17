import type { Muya } from '../muya';
import type { IClipboardPayload } from './copyData';
import { isClipboardEvent, isKeyboardEvent } from '../utils';
import { getClipboardData, writeClipboardData } from './copyData';
import { cutSelection } from './cut';
import { pastePlainText, pasteSelection } from './paste';
import { CopyType, PasteType } from './types';

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

            if (this.selection.table.hasSelection)
                return;

            const { isSelectionInSameBlock } = this.selection.getSelection() ?? {};
            if (isSelectionInSameBlock)
                return;

            // TODO: Is there any way to identify these key bellow?
            if (
                /Alt|Option|Meta|Shift|CapsLock|ArrowUp|ArrowDown|ArrowLeft|ArrowRight/.test(
                    key,
                )
            ) {
                return;
            }

            if (metaKey)
                return;

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
