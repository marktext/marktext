import type { Muya } from '../../../muya';
import type { ICursor } from '../../../selection/types';
import type Parent from '../../base/parent';
import type { TBlockPath } from '../../types';
import Content from '../../base/content';
import { ScrollPage } from '../../scrollPage';

class FrontmatterValueContent extends Content {
    static override blockName = 'frontmatter.value.content';

    static create(muya: Muya, value: string) {
        return new FrontmatterValueContent(muya, value);
    }

    override get path(): TBlockPath {
        if (this.parent == null)
            return ['value'];
        const { path: pPath } = this.parent;
        return [...pPath, 'value'];
    }

    constructor(muya: Muya, value: string) {
        super(muya, value);
        this.classList = [...this.classList, 'mu-frontmatter-value'];
        this.createDomNode();
    }

    override update(cursor?: ICursor) {
        const { text } = this;
        this.domNode!.innerHTML = `<span class="mu-syntax-text">${text}</span>`;
        if (cursor)
            this.selection.setSelection({ ...cursor, block: this, path: this.path });
    }

    override inputHandler(_event: Event) {
        if (this.isComposed)
            return;

        const textContent = this.domNode!.textContent ?? '';
        const { start, end } = this.getCursor()!;
        this.text = textContent;
        this.setCursor(start.offset, end.offset, true);
    }

    override enterHandler(event: Event) {
        event.preventDefault();
        // Enter in value → add a new row after the current one.
        const frontmatter = this.closestBlock('frontmatter');
        if (frontmatter && 'addProperty' in frontmatter)
            (frontmatter as { addProperty: () => void }).addProperty();
    }

    override tabHandler(event: Event) {
        event.preventDefault();
        event.stopPropagation();
        const isShift = 'shiftKey' in event && (event as KeyboardEvent).shiftKey;
        if (isShift) {
            // Move to key of this row.
            const keyContent = this.previousContentInContext();
            keyContent?.setCursor(keyContent.text.length, keyContent.text.length, true);
        }
        else {
            // Move to key of next row, or create a new row.
            const next = this.nextContentInContext();
            if (next) {
                next.setCursor(0, 0, true);
            }
            else {
                const frontmatter = this.closestBlock('frontmatter');
                if (frontmatter && 'addProperty' in frontmatter)
                    (frontmatter as { addProperty: () => void }).addProperty();
            }
        }
    }

    override arrowHandler(event: Event) {
        if (!('key' in event))
            return;
        const ke = event as KeyboardEvent;
        if (ke.key === 'ArrowDown' || ke.key === 'ArrowUp') {
            event.preventDefault();
            event.stopPropagation();
            const target = ke.key === 'ArrowDown'
                ? this.nextContentInContext()
                : this.previousContentInContext();
            if (target) {
                const offset = ke.key === 'ArrowDown' ? 0 : target.text.length;
                target.setCursor(offset, offset, true);
            }
            else if (ke.key === 'ArrowDown') {
                // Navigate out of frontmatter.
                const fm = this.closestBlock('frontmatter');
                const next = (fm?.next as Parent | null | undefined)?.firstContentInDescendant();
                if (next) {
                    next.setCursor(0, 0, true);
                }
                else {
                    const newPara = ScrollPage.loadBlock('paragraph').create(this.muya, { name: 'paragraph', text: '' });
                    this.scrollPage?.append(newPara, 'user');
                    newPara.firstContentInDescendant()?.setCursor(0, 0, true);
                }
            }
        }
        else {
            super.arrowHandler(event);
        }
    }
}

export default FrontmatterValueContent;
