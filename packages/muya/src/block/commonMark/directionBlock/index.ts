import type { Muya } from '../../../muya';
import type { IDirectionBlockState } from '../../../state/types';
import type { Nullable } from '../../../types';
import { mixins } from '../../../utils';
import Parent from '../../base/parent';
import IContainerQueryBlock from '../../mixins/containerQueryBlock';
import { ScrollPage } from '../../scrollPage';

@mixins(IContainerQueryBlock)
class DirectionBlock extends Parent {
    static override blockName = 'direction-block';

    static create(muya: Muya, state: IDirectionBlockState) {
        const dirBlock = new DirectionBlock(muya, state.meta.dir);

        for (const child of state.children)
            dirBlock.append(ScrollPage.loadBlock(child.name).create(muya, child));

        return dirBlock;
    }

    override get path() {
        const { path: pPath } = this.parent!;
        const offset = this.parent!.offset(this);

        return [...pPath, offset, 'children'];
    }

    constructor(muya: Muya, dir: 'ltr' | 'rtl') {
        super(muya);
        this.tagName = 'div';
        this.attributes = { dir };
        this.classList = ['mu-direction-block'];
        this.createDomNode();
    }

    updateDir(dir: 'ltr' | 'rtl') {
        this.attributes = { dir };
        if (this.domNode)
            this.domNode.setAttribute('dir', dir);
    }

    // Direction-blocks wrap exactly one block. When Enter (or any other action)
    // inserts a second child, route it to the parent (ScrollPage) as a sibling
    // after this direction-block, giving the new block its own "follow document"
    // direction instead of inheriting ours.
    override insertBefore(newNode: Parent, refNode: Nullable<Parent> = null, source = 'user') {
        if (this.children.head !== null && newNode !== this.children.head) {
            return this.parent!.insertBefore(newNode, this.next as Nullable<Parent>, source);
        }

        return super.insertBefore(newNode, refNode, source);
    }

    override getState(): IDirectionBlockState {
        return {
            name: 'direction-block',
            meta: { dir: (this.attributes.dir ?? 'ltr') as 'ltr' | 'rtl' },
            children: this.children.map(child => (child as Parent).getState()),
        };
    }
}

export default DirectionBlock;
