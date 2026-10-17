import type { Muya } from '../../../muya';
import type { IBlockQuoteState } from '../../../state/types';
import type Content from '../../base/content';
import type Parent from '../../base/parent';
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

    backspaceAtStart(content: Content, event: Event): boolean {
        const cursor = content.getCursor();
        const paragraph = content.parent;
        if (cursor?.start.offset !== 0 || cursor.end.offset !== 0 || paragraph?.parent !== this || !paragraph.isFirstChild())
            return false;
        event.preventDefault();
        if (paragraph.isOnlyChild()) {
            this.replaceWith(paragraph);
            paragraph.firstContentInDescendant()?.setCursor(0, 0, true);
        }
        else {
            const outside = paragraph.clone() as Parent;
            this.parent!.insertBefore(outside, this);
            paragraph.remove();
            outside.firstContentInDescendant()?.setCursor(0, 0, true);
        }
        return true;
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
