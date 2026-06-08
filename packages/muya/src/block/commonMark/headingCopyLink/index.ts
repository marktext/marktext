import type { Muya } from '../../../muya';
import formatLinkIcon from '../../../assets/icons/format_link/2.png';
import { CLASS_NAMES } from '../../../config';
import { stableSlug } from '../../../state/getTOC';
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
        this.tagName = 'i';
        this.classList = ['mu-icon', CLASS_NAMES.MU_COPY_HEADER_LINK];
        this.attributes = { contenteditable: 'false' };
        this.createDomNode();

        const img = document.createElement('img');
        img.classList.add('mu-icon-inner');
        img.setAttribute('src', formatLinkIcon);
        this.domNode!.appendChild(img);

        this.listen();
    }

    listen() {
        const { domNode, muya } = this;
        const { eventCenter } = muya;

        const clickHandler = (event: Event) => {
            // The handler is bound to a `click` DOM event on the affordance, so
            // it is inherently a pointer interaction — no mouse-specific
            // properties are read, so no `MouseEvent` narrowing is needed.
            event.preventDefault();
            event.stopPropagation();

            // At click time the attachment's parent is the heading block.
            const heading = this.parent;
            if (!heading)
                return;

            eventCenter.emit('heading-copy-link', {
                key: stableSlug(heading),
            });
        };

        this._eventIds.push(
            eventCenter.attachDOMEvent(domNode!, 'click', clickHandler),
        );
    }

    detachDOMEvents() {
        for (const id of this._eventIds)
            this.muya.eventCenter.detachDOMEvent(id);
    }

    override remove(_source: string) {
        super.remove();
        this.detachDOMEvents();

        return this;
    }

    getState() {
        debug.warn('You should never call this method.');
    }
}

export default HeadingCopyLink;
