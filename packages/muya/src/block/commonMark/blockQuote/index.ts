import type { Muya } from '../../../muya';
import type { IBlockQuoteState } from '../../../state/types';
import { mixins } from '../../../utils';
import Parent from '../../base/parent';
import IContainerQueryBlock from '../../mixins/containerQueryBlock';
import { ScrollPage } from '../../scrollPage';

@mixins(IContainerQueryBlock)
class BlockQuote extends Parent {
    static override blockName = 'block-quote';

    static create(muya: Muya, state: IBlockQuoteState) {
        const blockQuote = new BlockQuote(muya);

        for (const child of state.children)
            blockQuote.append(ScrollPage.loadBlock(child.name).create(muya, child));

        return blockQuote;
    }

    override get path() {
        const { path: pPath } = this.parent!;
        const offset = this.parent!.offset(this);

        return [...pPath, offset, 'children'];
    }

    constructor(muya: Muya) {
        super(muya);
        this.tagName = 'blockquote';
        this.classList = ['mu-block-quote'];
        this.createDomNode();
    }

    override getState(): IBlockQuoteState {
        const state: IBlockQuoteState = {
            name: 'block-quote',
            children: this.children.map(child => (child as Parent).getState()),
        };

        return state;
    }
}

export default BlockQuote;
