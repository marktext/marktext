import type { Muya } from '../../muya';
import type { Nullable } from '../../types';
import type { IAttributes, IDatasets } from '../../utils/types';
import type { IConstructor } from '../types';
import type Content from './content';
import type { ILinkedNode } from './linkedList/linkedNode';
import type Parent from './parent';
import { BLOCK_DOM_PROPERTY, CLASS_NAMES } from '../../config';
import { ChangeSource } from '../../types';
import { createDomNode } from '../../utils/dom';
import { isHiddenByFold, refreshFoldVisibility } from '../folding';

class TreeNode implements ILinkedNode {
    prev: Nullable<TreeNode> = null;

    next: Nullable<TreeNode> = null;

    parent: Nullable<Parent> = null;

    domNode: Nullable<HTMLElement> = null;

    tagName: string = '';

    classList: string[] = [];

    attributes: IAttributes = {};

    datasets: IDatasets = {};

    static blockName = 'tree.node';

    protected get static(): IConstructor<TreeNode> {
        // `this.constructor` is `Function` in lib.d.ts; subclasses' generated
        // constructors carry the static `blockName` etc., but TS can't see
        // through `Function` to the subclass shape.
        // eslint-disable-next-line no-restricted-syntax
        return this.constructor as unknown as IConstructor<TreeNode>;
    }

    get blockName() {
        return this.static.blockName;
    }

    get jsonState() {
        return this.muya.editor.jsonState;
    }

    get scrollPage() {
        return this.muya.editor.scrollPage;
    }

    get isScrollPage() {
        return this.blockName === 'scrollpage';
    }

    get isOutMostBlock(): boolean {
        return this.parent ? this.parent.isScrollPage : false;
    }

    get outMostBlock(): Nullable<Parent> {
        // `this.isContent()` returns false only when `this` is a Parent
        // subclass — but the base-class type signature is `TreeNode`. The
        // `this as Parent` widening can't be expressed without a cast.
        // eslint-disable-next-line no-restricted-syntax
        let node = this.isContent() ? this.parent : this as unknown as Parent;

        while (node) {
            if (node.isOutMostBlock)
                return node;

            node = node.parent;
        }

        return null;
    }

    constructor(public muya: Muya) {}

    isContent(this: TreeNode): this is Content {
        return 'text' in this;
    }

    isParent(this: TreeNode): this is Parent {
        return 'children' in this;
    }

    createDomNode() {
        const { tagName, classList, attributes, datasets } = this;

        const domNode = createDomNode(tagName, {
            classList,
            attributes,
            datasets,
        });

        // Concrete subclasses are always Parent | Content, but the static
        // signature here is TreeNode (Format extends Content via a separate
        // file). Mark the DOM property with the runtime subtype.
        // eslint-disable-next-line no-restricted-syntax
        domNode[BLOCK_DOM_PROPERTY] = this as unknown as Parent | Content;

        this.domNode = domNode;
    }

    /** Pass skipFolded for caret navigation; editing defaults to the full block tree. */
    previousContentInContext(skipFolded = false): Nullable<Content> {
        if (this.isScrollPage || !this.parent)
            return null;

        if (skipFolded) {
            let content = this.previousContentInContext();
            while (content && isHiddenByFold(content))
                content = content.previousContentInContext();
            return content;
        }

        const { parent } = this;

        // Walk previous siblings, skipping empty containers (e.g. a list item
        // whose only paragraph was removed) that hold no content descendant.
        // Otherwise such a sibling yields null and the caret gets stuck when
        // navigating up/left across it (#4644).
        let sibling = parent.prev;
        while (sibling) {
            if (sibling.isParent()) {
                const content = sibling.lastContentInDescendant();
                if (content)
                    return content;
            }
            else {
                return sibling; // language input
            }
            sibling = sibling.prev;
        }

        return parent.previousContentInContext();
    }

    /** Pass skipFolded for caret navigation; editing defaults to the full block tree. */
    nextContentInContext(skipFolded = false): Nullable<Content> {
        if (this.isScrollPage || !this.parent)
            return null;

        if (skipFolded) {
            let content = this.nextContentInContext();
            while (content && isHiddenByFold(content))
                content = content.nextContentInContext();
            return content;
        }

        const { parent } = this;

        if (this.blockName === 'language-input')
            return parent.lastContentInDescendant();

        // Walk next siblings, skipping empty containers with no content
        // descendant so the caret can cross them instead of getting stuck (#4644).
        let sibling = parent.next;
        while (sibling) {
            if (sibling.isParent()) {
                const content = sibling.firstContentInDescendant();
                if (content)
                    return content;
            }
            else {
                return sibling; // language input
            }
            sibling = sibling.next;
        }

        return parent.nextContentInContext();
    }

    isOnlyChild() {
        return this.isFirstChild() && this.isLastChild();
    }

    isFirstChild() {
        return this.prev === null;
    }

    isLastChild() {
        return this.next === null;
    }

    isInBlock(block: Parent) {
        let parent = this.parent;
        while (parent) {
            if (parent === block)
                return true;

            parent = parent.parent;
        }

        return false;
    }

    closestBlock(blockName: string): Nullable<TreeNode> {
        if (this.blockName === blockName)
            return this;

        let parent = this.parent;

        while (parent) {
            if (parent.blockName === blockName)
                return parent;

            parent = parent.parent;
        }

        return null;
    }

    farthestBlock(blockName: string): Nullable<TreeNode> {
        const results: TreeNode[] = [];
        if (this.blockName === blockName)
            results.push(this);

        let parent = this.parent;

        while (parent) {
            if (parent.blockName === blockName)
                results.push(parent);

            parent = parent.parent;
        }
        const popItem = results.pop();

        return popItem || null;
    }

    insertInto(parent: Parent, refBlock: Nullable<Parent> = null) {
        if (!this.muya.canMutate)
            return;
        if (this.parent === parent && this.next === refBlock)
            return;

        if (this.parent)
            this.parent.removeChild(this);

        // `parent.insertBefore` takes a Parent (the tree's internal linked
        // list operates on Parent), but TreeNode.insertInto is also called
        // from Content subclasses which extend TreeNode, not Parent.
        // eslint-disable-next-line no-restricted-syntax
        parent.insertBefore(this as unknown as Parent, refBlock);
    }

    remove(_source: ChangeSource = ChangeSource.User) {
        if (!this.muya.canMutate)
            return;
        if (!this.parent)
            return;

        const parent = this.parent;
        parent.children.remove(this);
        this.parent = null;
        this.domNode?.remove();
        this.domNode?.classList.remove(CLASS_NAMES.MU_FOLDED_CONTENT);
        refreshFoldVisibility(parent);

        return this;
    }
}

export default TreeNode;
