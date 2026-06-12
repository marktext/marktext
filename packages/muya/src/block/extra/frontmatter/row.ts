import type { Muya } from '../../../muya';
import type { IFrontmatterPropertyState } from '../../../state/types';
import type { TBlockPath } from '../../types';
import type FrontmatterKeyContent from './keyContent';
import type FrontmatterValueContent from './valueContent';
import { LinkedList } from '../../base/linkedList/linkedList';
import Parent from '../../base/parent';
import { ScrollPage } from '../../scrollPage';

class FrontmatterRow extends Parent {
    override children: LinkedList<FrontmatterKeyContent | FrontmatterValueContent> = new LinkedList();

    static override blockName = 'frontmatter.row';

    static create(muya: Muya, state: IFrontmatterPropertyState) {
        const row = new FrontmatterRow(muya);

        row.append(
            ScrollPage.loadBlock('frontmatter.key.content').create(muya, state.key),
            ScrollPage.loadBlock('frontmatter.value.content').create(muya, state.value),
        );

        return row;
    }

    override get path(): TBlockPath {
        const { path: pPath } = this.parent!;
        const offset = this.parent!.offset(this);
        return [...pPath, offset];
    }

    queryBlock(path: TBlockPath) {
        if (path.length === 0)
            return this;
        const key = path[0];
        if (key === 'key')
            return this.firstContentInDescendant();
        if (key === 'value')
            return this.lastContentInDescendant();
        return this;
    }

    constructor(muya: Muya) {
        super(muya);
        this.tagName = 'div';
        this.classList = ['mu-frontmatter-row'];
        this.createDomNode();

        // Drag-handle icon — non-editable, not a block.
        const handle = document.createElement('span');
        handle.className = 'mu-frontmatter-drag-handle';
        handle.contentEditable = 'false';
        handle.setAttribute('contenteditable', 'false');
        handle.setAttribute('draggable', 'true');
        handle.textContent = '⋮⋮';
        this.domNode!.appendChild(handle);
    }

    override getState(): IFrontmatterPropertyState {
        return {
            name: 'frontmatter.row',
            key: (this.firstContentInDescendant() as FrontmatterKeyContent | null)?.text ?? '',
            value: (this.lastContentInDescendant() as FrontmatterValueContent | null)?.text ?? '',
        };
    }
}

export default FrontmatterRow;
