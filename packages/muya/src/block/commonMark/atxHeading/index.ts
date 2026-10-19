import type { Muya } from '../../../muya';
import type { IAtxHeadingState } from '../../../state/types';
import type Content from '../../base/content';
import type { TBlockPath } from '../../types';
import { CLASS_NAMES } from '../../../config';
import { mixins } from '../../../utils';
import Parent from '../../base/parent';
import { isHiddenByFold, refreshFoldVisibility } from '../../folding';
import LeafQueryBlock from '../../mixins/leafQueryBlock';
import { ScrollPage } from '../../scrollPage';
import HeadingFoldToggle from '../headingFoldToggle';

@mixins(LeafQueryBlock)
class AtxHeading extends Parent {
    public meta: IAtxHeadingState['meta'];

    // Runtime-only UI state — fold is a visual concern and is never serialized
    // to markdown (see `getState`, which omits it).
    private _folded = false;
    private _foldToggle: HeadingFoldToggle;

    static override blockName = 'atx-heading';

    static create(muya: Muya, state: IAtxHeadingState) {
        const heading = new AtxHeading(muya, state);

        heading.appendAttachment(
            ScrollPage.loadBlock('heading-copy-link').create(muya, null),
            heading._foldToggle,
        );

        heading.append(
            ScrollPage.loadBlock('atxheading.content').create(muya, state.text),
        );

        return heading;
    }

    override get path(): TBlockPath {
        const { path: pPath } = this.parent!;
        const offset = this.parent!.offset(this);

        return [...pPath, offset];
    }

    constructor(muya: Muya, { meta }: IAtxHeadingState) {
        super(muya);
        this.tagName = `h${meta.level}`;
        this.meta = meta;
        this.classList = ['mu-atx-heading'];
        this.createDomNode();
        this._foldToggle = HeadingFoldToggle.create(muya);
    }

    get folded() {
        return this._folded;
    }

    /** Fold state is transient; placing a caret in hidden content reveals its section. */
    toggleFold(folded: boolean = !this._folded) {
        if (folded === this._folded)
            return;

        this._folded = folded;
        if (this.parent)
            refreshFoldVisibility(this.parent, true);
        this.domNode?.classList.toggle(CLASS_NAMES.MU_FOLDED, folded);
        this._foldToggle.reflectFolded(folded);

        // A keyboard selection must never remain in content that just disappeared.
        const { anchorBlock, focusBlock } = this.muya.editor.selection;
        if (folded && [anchorBlock, focusBlock].some(block =>
            block && isHiddenByFold(block),
        )) {
            const content = this.children.head;
            if (content?.isContent())
                content.setCursor(content.text.length, content.text.length, true);
        }
    }

    override getState(): IAtxHeadingState {
        return {
            name: 'atx-heading',
            meta: this.meta,
            text: (this.children.head as Content).text,
        };
    }
}

export default AtxHeading;
