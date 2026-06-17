import type { Muya } from '../../../muya';
import formatLinkIcon from '../../../assets/icons/format_link/2.png';
import { CLASS_NAMES } from '../../../config';
import { stableSlug } from '../../../state/getTOC';
import { isKeyboardEvent } from '../../../utils';
import logger from '../../../utils/logger';
import TreeNode from '../../base/treeNode';

const debug = logger('headingCopyLink:');

// marktext rendered an `i.icon.ag-copy-header-link` hover affordance on every
// heading; clicking it dispatched `heading-copy-link` { key } and the desktop
// renderer copied the heading's GitHub slug/anchor to the clipboard. The new
// engine has no equivalent affordance — this attachment block restores it.
//
// It is appended to its heading via `appendAttachment` (the same mechanism the
// task-list checkbox uses), so it carries its own DOM node and click handler
// without participating in document state. The emitted `key` is the heading's
// stable slug — the SAME value `getTOC()` exposes as `ITocItem.slug` — so the
// host can resolve it back to a TOC entry (`copyGithubSlug`).
class HeadingCopyLink extends TreeNode {
    private _eventIds: string[] = [];

    static override blockName = 'heading-copy-link';

    // `_state` is unused — the affordance carries no document state — but the
    // `ScrollPage.loadBlock(...).create(muya, state)` contract requires the
    // second parameter, so accept and ignore it.
    static create(muya: Muya, _state?: unknown) {
        return new HeadingCopyLink(muya);
    }

    get isContainerBlock() {
        return false;
    }

    constructor(muya: Muya) {
        super(muya);
        const label = muya.i18n.t('Copy anchor link to this heading');
        this.tagName = 'i';
        this.classList = ['mu-icon', CLASS_NAMES.MU_COPY_HEADER_LINK];
        // Accessible button semantics: discoverable + focusable + operable by
        // assistive tech and keyboard (the keydown handler below activates it).
        this.attributes = {
            'contenteditable': 'false',
            'role': 'button',
            'tabindex': '0',
            'aria-label': label,
            'title': label,
        };
        this.createDomNode();

        // The button carries the accessible label, so the icon image is purely
        // decorative — an empty `alt` keeps screen readers from announcing it
        // twice and satisfies the `image-alt` a11y rule.
        const img = document.createElement('img');
        img.classList.add('mu-icon-inner');
        img.setAttribute('src', formatLinkIcon);
        img.setAttribute('alt', '');
        this.domNode!.appendChild(img);

        this._listen();
    }

    private _listen() {
        const { domNode, muya } = this;
        const { eventCenter } = muya;

        const clickHandler = (event: Event) => {
            // The handler is bound to a `click` DOM event on the affordance, so
            // it is inherently a pointer interaction — no mouse-specific
            // properties are read, so no `MouseEvent` narrowing is needed.
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

    // Emit `heading-copy-link` with the heading's stable slug. At activation
    // time the attachment's parent is the heading block.
    private _activate() {
        const heading = this.parent;
        if (!heading)
            return;

        this.muya.eventCenter.emit('heading-copy-link', {
            key: stableSlug(heading),
        });
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

export default HeadingCopyLink;
