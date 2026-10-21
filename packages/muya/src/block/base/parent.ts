import type { TState } from '../../state/types';
import type { Nullable } from '../../types';
import type { TBlockPath } from '../types';
import { LinkedList } from '../../block/base/linkedList/linkedList';
import TreeNode from '../../block/base/treeNode';
import { CLASS_NAMES } from '../../config';
import { ChangeSource } from '../../types';
import { operateClassName } from '../../utils/dom';
import logger from '../../utils/logger';
import { isFoldableHeading } from '../commonMark/atxHeading/foldSection';
import { refreshFoldVisibility } from '../folding';

const debug = logger('parent:');

class Parent extends TreeNode {
    // UI attachments are excluded from the serialized document children.
    attachments: LinkedList<TreeNode> = new LinkedList();

    children: LinkedList<TreeNode> = new LinkedList();

    override prev: Nullable<Parent> = null;

    override next: Nullable<Parent> = null;

    private _active: boolean = false;

    get active() {
        return this._active;
    }

    set active(value) {
        this._active = value && !this.muya.isReadOnly;
        value = this._active;

        if (this.domNode == null) {
            debug.error('domNode is null.');

            return;
        }

        if (value)
            operateClassName(this.domNode, 'add', CLASS_NAMES.MU_ACTIVE);
        else
            operateClassName(this.domNode, 'remove', CLASS_NAMES.MU_ACTIVE);
    }

    get firstChild() {
        return this.children.head;
    }

    get lastChild() {
        return this.children.tail;
    }

    protected get isContainerBlock() {
        // `task-list-item` is intentionally omitted: it shares the
        // `task-list` prefix and would be matched by the alternative above.
        return /block-quote|order-list|bullet-list|task-list|list-item/.test(
            this.blockName,
        );
    }

    get path(): TBlockPath {
        debug.error('You should never call get path on Parent.');
        return [];
    }

    private _getJsonPath() {
        const { path } = this;
        if (this.isContainerBlock)
            path.pop();

        return path;
    }

    getState(): TState {
        debug.error('You should never call get state on Parent.');
        return {} as TState;
    }

    clone() {
        const state = this.getState();
        const { muya } = this;

        return this.static.create(muya, state);
    }

    length() {
        return this.reduce((acc: number) => acc + 1, 0);
    }

    offset(node: TreeNode) {
        return this.children.offset(node);
    }

    find(offset: number) {
        return this.children.find(offset);
    }

    append(...childrenAndSource: [...Parent[], ChangeSource]): void;
    append(...children: Parent[]): void;
    append(...args: unknown[]) {
        if (!this.muya.canMutate)
            return;
        const last = args[args.length - 1];
        const source = last === ChangeSource.User || last === ChangeSource.Api ? last : ChangeSource.Api;
        if (last === ChangeSource.User || last === ChangeSource.Api)
            args.pop();
        const children = args as Parent[];

        children.forEach((node) => {
            node.parent = this;
            const { domNode } = node;
            this.domNode!.appendChild(domNode!);
        });

        this.children.append(...children);
        refreshFoldVisibility(this, children.some(node => isFoldableHeading(node) && node.folded));

        if (source === ChangeSource.User) {
            children.forEach((node) => {
                const path = node._getJsonPath();
                const state = node.getState();
                this.jsonState.insertOperation(path, state);
            });
        }
    }

    /**
     * This method will only be used when initialization.
     * @param  {...any} nodes attachment blocks
     */
    protected appendAttachment(...nodes: TreeNode[]) {
        nodes.forEach((node) => {
            node.parent = this;
            const { domNode } = node;
            this.domNode!.appendChild(domNode!);
        });

        this.attachments.append(...nodes);
    }

    forEachAt(
        index: number,
        length: number = this.length(),
        callback: (cur: TreeNode, i: number) => void,
    ) {
        return this.children.forEachAt(index, length, callback);
    }

    forEach(callback: (cur: TreeNode, i: number) => void) {
        return this.children.forEach(callback);
    }

    map<M>(callback: (cur: TreeNode, i: number) => M): M[] {
        return this.children.map(callback);
    }

    reduce<M>(
        callback: (memo: M, cur: TreeNode, i: number) => M,
        initialValue: M,
    ): M {
        return this.children.reduce<M>(callback, initialValue);
    }

    replaceWith(block: Parent, source: ChangeSource = ChangeSource.User) {
        if (!this.muya.canMutate)
            return;
        if (!this.parent) {
            debug.warn('Call replaceWith need has a parent block');

            return;
        }

        this.parent.insertBefore(block, this, source);
        block.parent = this.parent;
        this.remove(source);

        return block;
    }

    insertBefore(
        newNode: Parent,
        refNode: Nullable<Parent> = null,
        source: ChangeSource = ChangeSource.User,
    ) {
        if (!this.muya.canMutate)
            return;
        newNode.parent = this;
        this.children.insertBefore(newNode, refNode);
        this.domNode!.insertBefore(
            newNode.domNode!,
            refNode ? refNode.domNode! : null,
        );

        refreshFoldVisibility(this, isFoldableHeading(newNode) && newNode.folded);

        if (source === ChangeSource.User) {
            const path = newNode._getJsonPath();
            const state = newNode.getState();
            this.jsonState.insertOperation(path, state);
        }

        return newNode;
    }

    insertAfter(newNode: Parent, refNode: Nullable<Parent> = null, source: ChangeSource = ChangeSource.User) {
        this.insertBefore(newNode, refNode ? refNode.next : null, source);

        return newNode;
    }

    override remove(source: ChangeSource = ChangeSource.User) {
        if (!this.muya.canMutate)
            return;
        if (source === ChangeSource.User) {
            const path = this._getJsonPath();
            this.jsonState.removeOperation(path);
        }

        super.remove(source);

        return this;
    }

    protected empty() {
        this.forEach((child) => {
            this.removeChild(child, ChangeSource.Api);
        });
    }

    removeChild(node: TreeNode, source: ChangeSource = ChangeSource.User) {
        if (!this.children.contains(node)) {
            debug.warn(
                'Can not removeChild(node), because node is not child of this block',
            );
        }

        if (node.isParent())
            node.remove(source);
        else if (node.isContent())
            node.remove();

        return node;
    }

    firstContentInDescendant() {
        let likeContentBlock: Nullable<TreeNode> = this.children.head;

        while (likeContentBlock && likeContentBlock.isParent()) {
            likeContentBlock = likeContentBlock.children.head;
        }

        return likeContentBlock?.isContent() ? likeContentBlock : null;
    }

    lastContentInDescendant() {
        let likeContentBlock: Nullable<TreeNode> = this.children.tail;

        while (likeContentBlock && likeContentBlock.isParent())
            likeContentBlock = likeContentBlock.children.tail;

        return likeContentBlock?.isContent() ? likeContentBlock : null;
    }

    breadthFirstTraverse(this: Parent, callback: (node: TreeNode) => void) {
        const queue: TreeNode[] = [this];

        while (queue.length) {
            const node = queue.shift()!;

            callback(node);

            if (node.isParent())
                node.children.forEach(child => queue.push(child));
        }
    }

    depthFirstTraverse(this: Parent, callback: (node: TreeNode) => void) {
        const stack: TreeNode[] = [this];

        while (stack.length) {
            const node = stack.shift()!;

            callback(node);

            if (node.isParent()) {
                // Prepend children in order so traversal visits the first document block first.
                node.children.forEach((child, i) => stack.splice(i, 0, child));
            }
        }
    }
}

export default Parent;
