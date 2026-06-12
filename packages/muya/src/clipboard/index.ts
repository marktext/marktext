import type { Muya } from '../muya';
import type { IClipboardPayload } from './copyData';
import { fromEvent, merge } from 'rxjs';
import { isClipboardEvent, isKeyboardEvent } from '../utils';
import { getClipboardData, writeClipboardData } from './copyData';
import { cutSelection } from './cut';
import { pasteSelection } from './paste';
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
        clipboard.listen();

        return clipboard;
    }

    constructor(public muya: Muya) {}

    listen() {
        const { domNode } = this.muya;

        const copyCutHandler = (event: Event) => {
            if (!isClipboardEvent(event))
                return;
            event.preventDefault();
            event.stopPropagation();

            const isCut = event.type === 'cut';

            this.copyHandler(event);

            if (isCut)
                this.cutHandler();
        };

        const keydownHandler = (event: Event) => {
            if (!isKeyboardEvent(event))
                return;
            const { key, metaKey } = event;

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
            if (isClipboardEvent(event))
                this.pasteHandler(event);
        };

        merge(fromEvent(domNode, 'copy'), fromEvent(domNode, 'cut'))
            .subscribe(copyCutHandler);

        fromEvent(domNode, 'paste').subscribe(pasteHandler);
        fromEvent(domNode, 'keydown').subscribe(keydownHandler);
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

    pasteAsPlainText() {
        this.pasteType = PasteType.PASTE_AS_PLAIN_TEXT;
        document.execCommand('paste');
        this.pasteType = PasteType.NORMAL;
    }

    copy(type: CopyType, info: string) {
        this.copyType = type;
        this.copyInfo = info;
        document.execCommand('copy');
        this.copyType = CopyType.NORMAL;
    }
}

export default Clipboard;
