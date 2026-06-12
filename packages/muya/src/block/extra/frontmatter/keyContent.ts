import type { Muya } from '../../../muya';
import type { ICursor } from '../../../selection/types';
import type { TBlockPath } from '../../types';
import Content from '../../base/content';

class FrontmatterKeyContent extends Content {
    static override blockName = 'frontmatter.key.content';

    static create(muya: Muya, key: string) {
        return new FrontmatterKeyContent(muya, key);
    }

    override get path(): TBlockPath {
        if (this.parent == null)
            return ['key'];
        const { path: pPath } = this.parent;
        return [...pPath, 'key'];
    }

    constructor(muya: Muya, key: string) {
        super(muya, key);
        this.classList = [...this.classList, 'mu-frontmatter-key'];
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
        // Enter in key → move to value of the same row.
        const row = this.parent;
        if (row && row.isParent()) {
            const value = row.lastContentInDescendant();
            value?.setCursor(0, 0, true);
        }
    }

    override tabHandler(event: Event) {
        event.preventDefault();
        event.stopPropagation();
        const isShift = 'shiftKey' in event && (event as KeyboardEvent).shiftKey;
        if (isShift) {
            // Shift+Tab: previous row's value, or exit frontmatter if first row.
            const prev = this.previousContentInContext();
            if (prev)
                prev.setCursor(prev.text.length, prev.text.length, true);
        }
        else {
            // Tab: move to value of the same row.
            const row = this.parent;
            if (row && row.isParent()) {
                const value = row.lastContentInDescendant();
                value?.setCursor(0, 0, true);
            }
        }
    }

    override backspaceHandler(event: Event) {
        const { start, end } = this.getCursor()!;
        if (start.offset !== 0 || start.offset !== end.offset)
            return super.backspaceHandler(event);

        event.preventDefault();
        event.stopPropagation();

        // Delete the row when key is empty at start.
        const row = this.parent;
        if (!row)
            return;

        const prevContent = this.previousContentInContext();
        row.remove('user');
        if (prevContent)
            prevContent.setCursor(prevContent.text.length, prevContent.text.length, true);
    }
}

export default FrontmatterKeyContent;
