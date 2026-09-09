import type { Muya } from '../../../muya';
import type { IFoldableHeading } from '../atxHeading/foldSection';
import { CLASS_NAMES } from '../../../config';
import { isKeyboardEvent } from '../../../utils';
import { operateClassName } from '../../../utils/dom';
import logger from '../../../utils/logger';
import TreeNode from '../../base/treeNode';
import { isFoldableHeading } from '../atxHeading/foldSection';

const debug = logger('headingFoldToggle:');

// Sibling UI affordance that folds/unfolds the section owned by a heading.
// It mirrors the `HeadingCopyLink` attachment: it carries its own DOM node and
// event handlers, is appended to its heading via `appendAttachment`, and takes
// part in no document state (fold is a purely visual, runtime-only concern —
// it is never serialized to markdown).
//
// Visual: a CSS-drawn chevron (see `blockSyntax.css`) that points down when the
// section is expanded and right when it is folded. No binary icon asset is
// needed, so the affordance inherits the active theme colour.
//
// On activation it delegates to `AtxHeading.toggleFold()`, which walks the
// sibling list and hides every following block until the next heading of an
// equal or higher level.
class HeadingFoldToggle extends TreeNode {
    private _eventIds: string[] = [];

    static override blockName = 'heading-fold-toggle';

    // `_state` is unused — the affordance carries no document state — but the
    // `ScrollPage.loadBlock(...).create(muya, state)` contract requires the
    // second parameter, so accept and ignore it.
    static create(muya: Muya, _state?: unknown) {
        return new HeadingFoldToggle(muya);
    }

    get isContainerBlock() {
        return false;
    }

    constructor(muya: Muya) {
        super(muya);
        this.tagName = 'span';
        this.classList = ['mu-icon', CLASS_NAMES.MU_FOLD_TOGGLE];
        // Accessible button semantics: discoverable + focusable + operable by
        // assistive tech and keyboard (the keydown handler below activates it).
        this.attributes = {
            'contenteditable': 'false',
            'role': 'button',
            'tabindex': '0',
            'aria-expanded': 'true',
        };
        this.createDomNode();

        // The chevron itself is drawn in CSS on this inner element so the
        // rotation transition has a dedicated node to animate.
        const chevron = document.createElement('span');
        chevron.classList.add('mu-fold-toggle-chevron');
        chevron.setAttribute('aria-hidden', 'true');
        this.domNode!.appendChild(chevron);

        this._updateLabel(false);
        this._listen();
    }

    private _listen() {
        const { domNode, muya } = this;
        const { eventCenter } = muya;

        const clickHandler = (event: Event) => {
            event.preventDefault();
            event.stopPropagation();
            this._activate();
        };

        // Keyboard activation (Enter / Space) for the focusable button, so it
        // is operable without a pointer.
        const keydownHandler = (event: Event) => {
            if (!isKeyboardEvent(event))
                return;
            if (event.key !== 'Enter' && event.key !== ' ')
                return;
            event.preventDefault();
            event.stopPropagation();
            this._activate();
        };

        this._eventIds.push(
            eventCenter.attachDOMEvent(domNode!, 'click', clickHandler),
            eventCenter.attachDOMEvent(domNode!, 'keydown', keydownHandler),
        );
    }

    private _activate() {
        const heading = this._ownerHeading();
        if (heading == null)
            return;

        heading.toggleFold();
    }

    // The heading this affordance is attached to. Returns null when the parent
    // is missing or is not actually a foldable heading — a defensive guard for
    // the brief windows during (un)mounting where `parent` may not yet be a
    // fully wired `AtxHeading`, so a stray click can't throw.
    private _ownerHeading(): IFoldableHeading | null {
        // Structural guard narrows the generic parent to a foldable heading,
        // covering the brief (un)mount windows where parent isn't wired yet.
        return isFoldableHeading(this.parent) ? this.parent : null;
    }

    // Reflect the folded state onto the affordance: aria-expanded, an accessible
    // label, and a class the CSS uses to rotate the chevron.
    reflectFolded(folded: boolean) {
        this._updateLabel(folded);

        if (this.domNode == null)
            return;

        this.domNode.setAttribute('aria-expanded', folded ? 'false' : 'true');
        operateClassName(
            this.domNode,
            folded ? 'add' : 'remove',
            CLASS_NAMES.MU_FOLDED,
        );
    }

    private _updateLabel(folded: boolean) {
        const label = this.muya.i18n.t(
            folded ? 'Unfold this section' : 'Fold this section',
        );

        if (this.domNode == null)
            return;

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

export default HeadingFoldToggle;
