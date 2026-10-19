import type { Muya } from '../../../muya';
import { CLASS_NAMES } from '../../../config';
import { isKeyboardEvent } from '../../../utils';
import { operateClassName } from '../../../utils/dom';
import logger from '../../../utils/logger';
import TreeNode from '../../base/treeNode';
import { isFoldableHeading } from '../atxHeading/foldSection';

const debug = logger('headingFoldToggle:');

// An attachment keeps fold controls out of document state and markdown exports.
class HeadingFoldToggle extends TreeNode {
    static override blockName = 'heading-fold-toggle';

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
        this.attributes = {
            'contenteditable': 'false',
            'role': 'button',
            'tabindex': '0',
            'aria-expanded': 'true',
        };
        this.createDomNode();

        const chevron = document.createElement('span');
        chevron.classList.add('mu-fold-toggle-chevron');
        chevron.setAttribute('aria-hidden', 'true');
        this.domNode!.appendChild(chevron);

        this._updateLabel(false);
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
        if (isFoldableHeading(this.parent))
            this.parent.toggleFold();
    }

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

    getState() {
        debug.warn('You should never call this method.');
    }
}

export default HeadingFoldToggle;
