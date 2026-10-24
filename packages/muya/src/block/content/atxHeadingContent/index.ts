import type { Muya } from '../../../muya';
import type { IRenderCursor } from '../../../selection/types';
import type AtxHeading from '../../commonMark/atxHeading';
import { atxHeadingBody, atxHeadingPrefixLength, splitAtxHeading } from '../../../state/headings';
import { isKeyboardEvent } from '../../../utils';
import Format from '../../base/format';
import { headingLevel, isFoldShortcut } from '../../commonMark/atxHeading/foldSection';
import { ScrollPage } from '../../scrollPage';

class AtxHeadingContent extends Format {
    public override parent: AtxHeading | null = null;

    static override blockName = 'atxheading.content';

    static create(muya: Muya, text: string) {
        const content = new AtxHeadingContent(muya, text);

        return content;
    }

    constructor(muya: Muya, text: string) {
        super(muya, text);
        this.classList = [...this.classList, 'mu-atxheading-content'];
        this.createDomNode();
    }

    override getAnchor() {
        return this.parent;
    }

    override beforeKeydown(event: KeyboardEvent): boolean {
        if (!isFoldShortcut(event))
            return false;

        event.preventDefault();
        event.stopPropagation();
        this.parent?.toggleFold();

        return true;
    }

    override update(cursor?: IRenderCursor, highlights = []) {
        return this.inlineRenderer.patch(this, cursor, highlights);
    }

    override enterHandler(event: Event) {
        const { start, end } = this.getCursor()!;
        const { level } = this.parent!.meta;

        if (isKeyboardEvent(event) && event.shiftKey) {
            event.preventDefault();
            event.stopPropagation();
            // ATX headings occupy one markdown line; an inline break preserves that boundary.
            this.muya.editor.history.markInputBoundary('insertLineBreak', '\n');
            const br = '<br/>';
            this.text = this.text.slice(0, start.offset) + br + this.text.slice(end.offset);
            this.setCursor(start.offset + br.length, start.offset + br.length, true);
            return;
        }

        if (!this.parent!.folded && atxHeadingBody(this.text) === '') {
            event.preventDefault();
            event.stopPropagation();
            this.text = '';
            this.convertToParagraph();
            return;
        }

        const prefixLength = atxHeadingPrefixLength(this.text);
        const { head, tail, suffix } = splitAtxHeading(this.text, start.offset, end.offset);
        const atStart = start.offset === end.offset && start.offset <= prefixLength;
        if (this.parent!.folded && !atStart) {
            event.preventDefault();
            event.stopPropagation();
            this.muya.editor.history.markInputBoundary('insertParagraph', '\n');
            const prefix = this.text.slice(0, prefixLength);
            const newHeading = ScrollPage.loadBlock('atx-heading').create(this.muya, {
                name: 'atx-heading',
                meta: { level },
                text: prefix + tail + suffix,
            });
            let boundary = this.parent!.next;
            while (boundary) {
                const nextLevel = headingLevel(boundary);
                if (nextLevel !== undefined && nextLevel <= level)
                    break;
                boundary = boundary.next;
            }
            this.parent!.parent!.insertBefore(newHeading, boundary);
            this.text = head + suffix;
            this.update();
            newHeading.firstContentInDescendant()!.setCursor(prefix.length, prefix.length, true);
            return;
        }

        if (atStart) {
            // Prevent native Enter from creating orphan spans after the new paragraph is inserted.
            event.preventDefault();
            event.stopPropagation();

            const newNodeState = {
                name: 'paragraph',
                text: '',
            };

            const newParagraphBlock = ScrollPage.loadBlock(newNodeState.name).create(
                this.muya,
                newNodeState,
            );
            this.parent!.parent!.insertBefore(newParagraphBlock, this.parent);
            this.setCursor(start.offset, end.offset, true);
        }
        else if (isKeyboardEvent(event)) {
            this.splitToParagraph(event, head + suffix, tail);
        }
    }

    override deleteHandler(event: KeyboardEvent): void {
        const { start, end } = this.getCursor()!;
        if (start.offset === end.offset && end.offset === this.text.length)
            this.parent?.toggleFold(false);
        super.deleteHandler(event);
    }

    override backspaceHandler(event: Event) {
        const { start, end } = this.getCursor()!;
        if (start.offset === 0 && end.offset === 0) {
            event.preventDefault();
            this.text = atxHeadingBody(this.text);
            this.convertToParagraph();
        }
        else {
            super.backspaceHandler(event);
        }
    }
}

export default AtxHeadingContent;
