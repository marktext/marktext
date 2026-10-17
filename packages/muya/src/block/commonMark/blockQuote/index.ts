import type { Muya } from '../../../muya';
import type { IBlockQuoteState } from '../../../state/types';
import QuoteContainer from '../../base/quoteContainer';

class BlockQuote extends QuoteContainer {
    static override blockName = 'block-quote';

    private _meta?: IBlockQuoteState['meta'];

    get meta() {
        return this._meta;
    }

    static create(muya: Muya, state: IBlockQuoteState) {
        const blockQuote = new BlockQuote(muya);
        blockQuote._meta = state.meta;

        blockQuote.loadChildren(state.children);

        return blockQuote;
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
            children: this.childStates(),
        };

        if (this._meta)
            state.meta = this._meta;

        return state;
    }
}

export default BlockQuote;
