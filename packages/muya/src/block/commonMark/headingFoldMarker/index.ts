import type { Muya } from '../../../muya';
import type { Nullable } from '../../../types';
import type { IFoldableHeading } from '../atxHeading/foldSection';
import { CLASS_NAMES } from '../../../config';
import { isKeyboardEvent } from '../../../utils';
import { operateClassName } from '../../../utils/dom';
import logger from '../../../utils/logger';
import TreeNode from '../../base/treeNode';
import { isFoldableHeading } from '../atxHeading/foldSection';

const debug = logger('headingFoldMarker:');

// The clickable "…" marker shown after a folded heading's text. It makes hidden
// content both discoverable (you can see a section is collapsed) and directly
// actionable (click to unfold), which is the most intuitive place to click.
//
// Why a real attachment block and not the CSS `::after` it replaces: a
// pseudo-element cannot receive its own click or carry button semantics. This
// mirrors `HeadingFoldToggle`/`HeadingCopyLink` — it owns its DOM node and
// handlers and takes part in no document state (fold is runtime-only).
//
// It is only visible while the heading is folded (see `reflectFolded` + CSS).
// Positioning avoids setting any intrinsic width on the heading, which froze
// the renderer previously (see docs/design/fold-heading-testing-notes.md).
class HeadingFoldMarker extends TreeNode {
    private _eventIds: string[] = [];

    static override blockName = 'heading-fold-marker';

    // `_state` is unused — the marker carries no document state — but the
    // `ScrollPage.loadBlock(...).create(muya, state)` contract requires the
    // second parameter, so accept and ignore it.
    static create(muya: Muya, _state?: unknown) {
        return new HeadingFoldMarker(muya);
    }

    get isContainerBlock() {
        return false;
    }

    constructor(muya: Muya) {
        super(muya);
        this.tagName = 'span';
        this.classList = ['mu-icon', CLASS_NAMES.MU_FOLD_MARKER];
        // Accessible button semantics. Hidden from the a11y tree until folded
        // (aria-hidden toggled in `reflectFolded`) so it isn't announced or
        // focusable while the section is open and the marker is not shown.
        this.attributes = {
            'contenteditable': 'false',
            'role': 'button',
            'tabindex': '-1',
            'aria-hidden': 'true',
        };
        this.createDomNode();
        // The "…" glyph is drawn in CSS (`.mu-fold-marker::after`), NOT set as
        // text here: a folded heading's `textContent` must stay equal to the
        // heading text so consumers that read it (TOC, search, outline) are not
        // polluted by the marker. The element itself stays clickable.

        this._updateLabel();
        this._listen();
    }

    private _listen() {
        const { domNode, muya } = this;
        const { eventCenter } = muya;

        const clickHandler = (event: Event) => {
            event.preventDefault();
            event.stopPropagation();
            this._unfold();
        };

        // Keyboard activation (Enter / Space) for when the marker is focusable
        // (i.e. while folded), so it is operable without a pointer.
        const keydownHandler = (event: Event) => {
            if (!isKeyboardEvent(event))
                return;
            if (event.key !== 'Enter' && event.key !== ' ')
                return;
            event.preventDefault();
            event.stopPropagation();
            this._unfold();
        };

        this._eventIds.push(
            eventCenter.attachDOMEvent(domNode!, 'click', clickHandler),
            eventCenter.attachDOMEvent(domNode!, 'keydown', keydownHandler),
        );
    }

    // Clicking the marker only ever unfolds — it is shown exclusively on a
    // folded heading, so there is no toggle ambiguity.
    private _unfold() {
        const heading = this._ownerHeading();
        heading?.toggleFold(false);
    }

    // The heading this marker is attached to, or null when the parent isn't a
    // fully wired foldable heading (defensive against mount/unmount races).
    private _ownerHeading(): Nullable<IFoldableHeading> {
        // Structural guard narrows the generic parent to a foldable heading,
        // covering the brief (un)mount windows where parent isn't wired yet.
        return isFoldableHeading(this.parent) ? this.parent : null;
    }

    // Reflect the heading's folded state onto the marker: show + expose it to
    // assistive tech and the tab order only while folded.
    reflectFolded(folded: boolean) {
        if (this.domNode == null)
            return;

        operateClassName(
            this.domNode,
            folded ? 'add' : 'remove',
            CLASS_NAMES.MU_FOLDED,
        );
        this.domNode.setAttribute('aria-hidden', folded ? 'false' : 'true');
        this.domNode.setAttribute('tabindex', folded ? '0' : '-1');
    }

    private _updateLabel() {
        if (this.domNode == null)
            return;

        const label = this.muya.i18n.t('Unfold this section');
        this.domNode.setAttribute('aria-label', label);
        this.domNode.setAttribute('title', label);
    }

    private _detachDOMEvents() {
        for (const id of this._eventIds)
            this.muya.eventCenter.detachDOMEvent(id);
    }

    override remove(_source: string) {
        super.remove();
        this._detachDOMEvents();

        return this;
    }

    getState() {
        debug.warn('You should never call this method.');
    }
}

export default HeadingFoldMarker;
