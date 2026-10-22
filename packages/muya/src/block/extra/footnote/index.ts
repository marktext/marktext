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

        // Identifier labels are UI attachments, not document children.
        const label = document.createElement('span');
        label.className = CLASS_NAMES.MU_FOOTNOTE_INPUT;
        label.textContent = state.meta.identifier;
        footnote.domNode!.appendChild(label);

        for (const child of state.children)
            footnote.append(ScrollPage.loadBlock(child.name).create(muya, child));

        const backlink = document.createElement('i');
        backlink.className = CLASS_NAMES.MU_FOOTNOTE_BACKLINK;
        backlink.textContent = '↩︎';
        backlink.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const target = document.getElementById(`noteref-${footnote.meta.identifier}`);
            target?.scrollIntoView({ behavior: 'smooth' });
        });
        footnote.domNode!.appendChild(backlink);

        return footnote;
    }

    // Footnotes use container paths into children, matching Parent’s JSON path routing.
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
