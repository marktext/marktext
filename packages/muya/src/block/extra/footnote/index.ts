import type { Muya } from '../../../muya';
import type { IFootnoteBlockMeta, IFootnoteBlockState } from '../../../state/types';
import { CLASS_NAMES } from '../../../config';
import { mixins } from '../../../utils';
import Parent from '../../base/parent';
import IContainerQueryBlock from '../../mixins/containerQueryBlock';
import { ScrollPage } from '../../scrollPage';

@mixins(IContainerQueryBlock)
class Footnote extends Parent {
    public meta: IFootnoteBlockMeta;

    static override blockName = 'footnote';

    static create(muya: Muya, state: IFootnoteBlockState) {
        const footnote = new Footnote(muya, state);

        // Render an identifier label inside the figure as a plain DOM span
        // (not a tracked Parent). The CSS `[^` / `]:` pseudo-elements wrap
        // the identifier so users see `[^id]:` against the block background
        // — matching marktext's visual treatment without making the label
        // part of `IFootnoteBlockState.children`.
        const label = document.createElement('span');
        label.className = CLASS_NAMES.MU_FOOTNOTE_INPUT;
        label.textContent = state.meta.identifier;
        footnote.domNode!.appendChild(label);

        for (const child of state.children)
            footnote.append(ScrollPage.loadBlock(child.name).create(muya, child));

        // Backlink arrow in the bottom-right of the figure. Clicking it
        // scrolls back up to the first inline `<sup id="noteref-{id}">`
        // reference.
        const backlink = document.createElement('i');
        backlink.className = CLASS_NAMES.MU_FOOTNOTE_BACKLINK;
        backlink.textContent = '↩︎';
        backlink.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const target = document.querySelector(
                `#noteref-${footnote.meta.identifier}`,
            );
            target?.scrollIntoView({ behavior: 'smooth' });
        });
        footnote.domNode!.appendChild(backlink);

        return footnote;
    }

    // Container-block path semantics: descendants address into `children`.
    // `Parent.getJsonPath` strips the trailing 'children' segment via
    // `isContainerBlock`, which we override below so footnote participates in
    // the same json1 op routing.
    override get path() {
        const { path: pPath } = this.parent!;
        const offset = this.parent!.offset(this);

        return [...pPath, offset, 'children'];
    }

    protected override get isContainerBlock() {
        return true;
    }

    constructor(muya: Muya, { meta }: IFootnoteBlockState) {
        super(muya);
        this.tagName = 'figure';
        this.meta = { identifier: meta.identifier };
        this.classList = [CLASS_NAMES.MU_FOOTNOTE];
        this.createDomNode();
    }

    override getState(): IFootnoteBlockState {
        return {
            name: 'footnote',
            meta: { identifier: this.meta.identifier },
            children: this.children.map(child => (child as Parent).getState()),
        };
    }
}

export default Footnote;
