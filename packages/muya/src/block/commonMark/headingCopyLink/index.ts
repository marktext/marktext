import type { Muya } from '../../../muya';
import formatLinkIcon from '../../../assets/icons/format_link/2.png';
import { CLASS_NAMES } from '../../../config';
import { stableSlug } from '../../../state/getTOC';
import { isKeyboardEvent } from '../../../utils';
import { showCopyFeedback } from '../../../utils/copyFeedback';
import logger from '../../../utils/logger';
import TreeNode from '../../base/treeNode';

const debug = logger('headingCopyLink:');

// Heading-link controls carry no document state. Their emitted key must match getTOC() slugs.
class HeadingCopyLink extends TreeNode {
    static override blockName = 'heading-copy-link';

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
        this.attributes = {
            'contenteditable': 'false',
            'role': 'button',
            'tabindex': '0',
            'aria-label': label,
            'title': label,
        };
        this.createDomNode();

        // The button owns the accessible label; its icon must stay decorative.
        const img = document.createElement('img');
        img.classList.add('mu-icon-inner');
        img.setAttribute('src', formatLinkIcon);
        img.setAttribute('alt', '');
        this.domNode!.appendChild(img);

        this._listen();
    }

    private _listen() {
        const { domNode } = this;

        const clickHandler = (event: Event) => {
            event.preventDefault();
            event.stopPropagation();
            this._activate();
        };

        const keydownHandler = (event: Event) => {
            if (!isKeyboardEvent(event))
                return;
            if (event.key !== 'Enter' && event.key !== ' ')
                return;
            event.preventDefault();
            event.stopPropagation();
            this._activate();
        };

        // The control owns these listeners so deleting its heading leaves no EventCenter references.
        domNode!.addEventListener('click', clickHandler);
        domNode!.addEventListener('keydown', keydownHandler);
    }

    private _activate() {
        const heading = this.parent;
        if (!heading)
            return;

        this.muya.eventCenter.emit('heading-copy-link', {
            key: stableSlug(heading),
            onCopied: (ok: boolean) => showCopyFeedback(
                this.domNode!,
                ok,
                this.muya.i18n.t('Copy anchor link to this heading'),
                this.muya.i18n,
            ),
        });
    }

    getState() {
        debug.warn('You should never call this method.');
    }
}

export default HeadingCopyLink;
