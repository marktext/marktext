import type { Muya } from '../../../muya';
import type { IAtxHeadingState } from '../../../state/types';
import type { Nullable } from '../../../types';
import type Content from '../../base/content';
import type Parent from '../../base/parent';
import type { TBlockPath } from '../../types';
import type HeadingFoldToggle from '../headingFoldToggle';
import type { IFoldSibling } from './foldSection';
import { CLASS_NAMES } from '../../../config';
import { mixins } from '../../../utils';
import { operateClassName } from '../../../utils/dom';
import ParentBlock from '../../base/parent';
import LeafQueryBlock from '../../mixins/leafQueryBlock';
import { ScrollPage } from '../../scrollPage';
import { collectSectionIndices, hiddenByFoldedDescendant } from './foldSection';

// Project a live sibling block down to the minimal structural view the pure
// section-resolution helper needs: its block name and (for headings) its level.
// Non-heading blocks have no `meta.level`, which resolves to `undefined` — the
// helper treats that as "not a section boundary".
function toFoldSibling(sibling: Parent): IFoldSibling {
    const heading = sibling as AtxHeading;
    return {
        blockName: sibling.blockName,
        level: heading.meta?.level,
        // Only headings carry a fold flag; `folded` is a getter on AtxHeading.
        folded: sibling.blockName === 'atx-heading' ? heading.folded : undefined,
    };
}

@mixins(LeafQueryBlock)
class AtxHeading extends ParentBlock {
    public meta: IAtxHeadingState['meta'];

    // Runtime-only UI state — fold is a visual concern and is never serialized
    // to markdown (see `getState`, which omits it).
    private _folded = false;

    static override blockName = 'atx-heading';

    static create(muya: Muya, state: IAtxHeadingState) {
        const heading = new AtxHeading(muya, state);

        heading.appendAttachment(
            ScrollPage.loadBlock('heading-copy-link').create(muya, null),
            ScrollPage.loadBlock('heading-fold-toggle').create(muya, null),
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
    }

    get folded() {
        return this._folded;
    }

    // The fold-toggle attachment appended in `create`. Located by block name so
    // this keeps working regardless of attachment ordering.
    private get _foldToggle(): Nullable<HeadingFoldToggle> {
        return this._attachmentByName('heading-fold-toggle') as Nullable<HeadingFoldToggle>;
    }

    // Find an attachment by its block name. Located by name (not index) so the
    // getters keep working regardless of the order attachments were appended.
    private _attachmentByName(blockName: string): Nullable<Parent> {
        let node = this.attachments.head as Nullable<Parent>;
        while (node) {
            if (node.blockName === blockName)
                return node;
            node = node.next;
        }

        return null;
    }

    // The top-level sibling blocks that follow this heading, in document order.
    private _followingSiblings(): Parent[] {
        const siblings: Parent[] = [];
        let node = this.next;
        while (node) {
            siblings.push(node);
            node = node.next;
        }

        return siblings;
    }

    /**
     * Fold or unfold the section owned by this heading: every following block
     * up to the next heading of equal-or-higher level. Fold is idempotent, so
     * calling with the current state is a no-op.
     */
    toggleFold(folded: boolean = !this._folded) {
        if (folded === this._folded)
            return;

        this._folded = folded;
        this._applyFold();
    }

    private _applyFold() {
        const siblings = this._followingSiblings();
        const sectionIndices = collectSectionIndices(
            this.meta.level,
            siblings.map(toFoldSibling),
        );

        // When unfolding, a block owned by a nested heading that is still folded
        // must stay hidden — otherwise unfolding an ancestor would reveal a
        // collapsed child's content. Precompute, per section block, whether it
        // belongs to a still-folded descendant.
        const sectionBlocks = sectionIndices.map(i => toFoldSibling(siblings[i]));
        const hiddenByDescendant = hiddenByFoldedDescendant(sectionBlocks);

        sectionIndices.forEach((index, i) => {
            const dom = siblings[index]?.domNode;
            if (dom == null)
                return;

            // Folding hides everything; unfolding reveals everything EXCEPT
            // blocks still owned by a folded nested heading.
            const shouldHide = this._folded || hiddenByDescendant[i];
            operateClassName(
                dom,
                shouldHide ? 'add' : 'remove',
                CLASS_NAMES.MU_FOLDED_CONTENT,
            );
        });

        // Mark the heading itself so the CSS can style a folded heading (keep
        // its chevron visible and rotated).
        if (this.domNode != null)
            this._setFoldedClass(this.domNode, CLASS_NAMES.MU_FOLDED);

        this._foldToggle?.reflectFolded(this._folded);
    }

    // Add the class when folded, remove it when unfolded. Wraps the add/remove
    // branch so the two call sites above read as intent, not DOM bookkeeping.
    private _setFoldedClass(dom: HTMLElement, className: string) {
        operateClassName(dom, this._folded ? 'add' : 'remove', className);
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
