import type { Muya } from '../../../muya';
import type { IAtxHeadingState } from '../../../state/types';
import type { Nullable } from '../../../types';
import type Content from '../../base/content';
import type Parent from '../../base/parent';
import type { TBlockPath } from '../../types';
import type HeadingFoldToggle from '../headingFoldToggle';
import type HeadingFoldMarker from '../headingFoldMarker';
import type { IFoldSibling } from './foldSection';
import { CLASS_NAMES } from '../../../config';
import { mixins } from '../../../utils';
import { operateClassName } from '../../../utils/dom';
import ParentBlock from '../../base/parent';
import LeafQueryBlock from '../../mixins/leafQueryBlock';
import { ScrollPage } from '../../scrollPage';
import { collectSectionIndices, foldPlanForLevel } from './foldSection';

// Project a live sibling block down to the minimal structural view the pure
// section-resolution helper needs: its block name and (for headings) its level.
// Non-heading blocks have no `meta.level`, which resolves to `undefined` — the
// helper treats that as "not a section boundary".
function toFoldSibling(sibling: Parent): IFoldSibling {
    return {
        blockName: sibling.blockName,
        level: (sibling as AtxHeading).meta?.level,
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

        // The "…" collapsed-section marker sits AFTER the content in the DOM so
        // it renders just past the heading text; it is only shown while folded.
        heading.appendAttachment(
            ScrollPage.loadBlock('heading-fold-marker').create(muya, null),
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

    // The clickable "…" marker attachment shown after the text while folded.
    private get _foldMarker(): Nullable<HeadingFoldMarker> {
        return this._attachmentByName('heading-fold-marker') as Nullable<HeadingFoldMarker>;
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

    /**
     * Fold every heading in the document — each section collapses, leaving only
     * the heading lines (the full outline). A document-wide action reachable
     * from the heading context menu.
     *
     * Note this is NOT `foldToLevel(1)`: folding "to level 1" keeps h1s open and
     * only folds their descendants, whereas "fold all" collapses every heading
     * including the h1s.
     */
    foldAll() {
        this._siblingHeadings().forEach(heading => heading.toggleFold(true));
    }

    /** Unfold every heading in the document — reveals all content. */
    unfoldAll() {
        this._siblingHeadings().forEach(heading => heading.toggleFold(false));
    }

    /**
     * Fold the document to `targetLevel`: headings deeper than the target fold,
     * headings at or above it unfold. `foldToLevel(2)` from a click on an h2
     * gives a table-of-contents view down to h2. The per-heading decision is
     * made by the pure `foldPlanForLevel` helper.
     */
    foldToLevel(targetLevel: number) {
        const headings = this._siblingHeadings();
        const plan = foldPlanForLevel(
            targetLevel,
            headings.map(heading => heading.meta.level),
        );

        headings.forEach((heading, i) => heading.toggleFold(plan[i]));
    }

    // Every heading block in the document, in document order. ATX headings are
    // top-level blocks, so they are siblings under this heading's parent (the
    // ScrollPage root). Returning `this`'s cohort keeps the document-wide
    // actions working from whichever heading the menu was opened on.
    private _siblingHeadings(): AtxHeading[] {
        const headings: AtxHeading[] = [];
        let node = this.parent?.firstChild as Nullable<Parent>;
        while (node) {
            if (node.blockName === 'atx-heading')
                headings.push(node as unknown as AtxHeading);
            node = node.next;
        }

        return headings;
    }

    private _applyFold() {
        const siblings = this._followingSiblings();
        const sectionIndices = collectSectionIndices(
            this.meta.level,
            siblings.map(toFoldSibling),
        );

        // Hide (or reveal) every block that belongs to this heading's section.
        for (const index of sectionIndices) {
            const dom = siblings[index]?.domNode;
            if (dom != null)
                this._setFoldedClass(dom, CLASS_NAMES.MU_FOLDED_CONTENT);
        }

        // Mark the heading itself so the CSS can style a folded heading (e.g.
        // keep its chevron visible and show the collapsed-section marker).
        if (this.domNode != null)
            this._setFoldedClass(this.domNode, CLASS_NAMES.MU_FOLDED);

        this._foldToggle?.reflectFolded(this._folded);
        this._foldMarker?.reflectFolded(this._folded);
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
