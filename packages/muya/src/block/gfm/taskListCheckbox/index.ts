import type { Muya } from '../../../muya';
import type { ITaskListItemMeta } from '../../../state/types';
import type { Nullable } from '../../../types';
import type Parent from '../../base/parent';
import type TaskList from '../taskList';
import type TaskListItem from '../taskListItem';
import { isFirefox } from '../../../config';
import { isHTMLInputElement, isMouseEvent } from '../../../utils';
import { operateClassName } from '../../../utils/dom';
import logger from '../../../utils/logger';
import TreeNode from '../../base/treeNode';

const debug = logger('tasklistCheckbox:');

// Block-name discriminators used by the autoCheck cascade to narrow the
// generic `TreeNode`/`Parent` tree shapes without a double-cast.
function isTaskListItem(node: Nullable<TreeNode>): node is TaskListItem {
    return !!node && node.blockName === 'task-list-item';
}

function isTaskList(node: Nullable<TreeNode>): node is TaskList {
    return !!node && node.blockName === 'task-list';
}

function isCheckbox(node: TreeNode): node is TaskListCheckbox {
    return node.blockName === TaskListCheckbox.blockName;
}

// Find the `task-list-checkbox` attachment of a `task-list-item`.
function checkboxOf(item: TaskListItem): TaskListCheckbox | null {
    let found: TaskListCheckbox | null = null;
    item.attachments.forEach((attachment: Parent) => {
        if (isCheckbox(attachment))
            found = attachment;
    });

    return found;
}

// Set a task item's checked state, dispatching the OT op (`TaskListItem.checked`
// setter) and syncing its checkbox DOM. No-op when already in the target state.
function setItemChecked(item: TaskListItem, checked: boolean): void {
    if (item.checked === checked)
        return;

    item.checked = checked;
    const checkbox = checkboxOf(item);
    if (checkbox)
        checkbox.syncDom(checked);
}

// The nested `task-list` directly under a `task-list-item`, if any. A task item
// holds a leading paragraph plus an optional nested list of sub-tasks.
function nestedTaskListOf(item: TaskListItem): TaskList | null {
    let nested: TaskList | null = null;
    item.children.forEach((child: TreeNode) => {
        if (isTaskList(child))
            nested = child;
    });

    return nested;
}

// Cascade `checked` to every descendant task item (depth-first).
function cascadeToDescendants(item: TaskListItem, checked: boolean): void {
    const nested = nestedTaskListOf(item);
    if (!nested)
        return;

    nested.children.forEach((child: TreeNode) => {
        if (!isTaskListItem(child))
            return;

        setItemChecked(child, checked);
        cascadeToDescendants(child, checked);
    });
}

// A parent item is checked iff every sibling in its task-list is checked.
function allSiblingsChecked(list: TaskList): boolean {
    let all = true;
    list.children.forEach((child: TreeNode) => {
        if (isTaskListItem(child) && !child.checked)
            all = false;
    });

    return all;
}

// Re-derive each ancestor task item: walking up from the toggled item's list,
// set every enclosing item to the computed state until one is unchanged.
function rederiveAncestors(item: TaskListItem): void {
    let list = item.parent;

    while (isTaskList(list)) {
        const ancestor = list.parent;
        if (!isTaskListItem(ancestor))
            return;

        const computed = allSiblingsChecked(list);
        if (ancestor.checked === computed)
            return;

        setItemChecked(ancestor, computed);
        list = ancestor.parent;
    }
}

// The Task List Item component is Firefox compatible, because in Firefox,
// the input element is not clickable in the contenteditable element(li),
// and in Firefox, the span element is used instead of the input element.
// In the Chrome browser, the input element is still preserved because in Chrome,
// span has a cursor staggered problem.
class TaskListCheckbox extends TreeNode {
    private _checked: boolean;

    private _eventIds: string[] = [];

    static override blockName = 'task-list-checkbox';

    static create(muya: Muya, meta: ITaskListItemMeta) {
        const checkbox = new TaskListCheckbox(muya, meta);

        return checkbox;
    }

    get path() {
        const { path: pPath } = this.parent!;
        pPath.pop(); // pop `children`

        return [...pPath, 'meta', 'checked'];
    }

    get isContainerBlock() {
        return false;
    }

    constructor(muya: Muya, { checked }: ITaskListItemMeta) {
        super(muya);
        this.tagName = isFirefox ? 'span' : 'input';
        this._checked = checked;
        this.attributes = isFirefox
            ? { contenteditable: 'false' }
            : { type: 'checkbox', contenteditable: 'false' };
        this.classList = ['mu-task-list-checkbox'];

        if (checked) {
            if (!isFirefox)
                this.attributes.checked = true;

            this.classList.push('mu-checkbox-checked');
        }

        this.createDomNode();
        this.listen();
    }

    listen() {
        const { domNode, muya } = this;
        const { eventCenter } = muya;
        const clickHandler = (event: Event) => {
            if (!isMouseEvent(event))
                return;

            event.stopPropagation();

            if (isFirefox) {
                this._checked = !this._checked;

                this.update(this._checked, 'user');
            }
            else if (isHTMLInputElement(event.target)) {
                const { checked } = event.target;
                this._checked = checked;
                this.update(checked, 'user');
            }
        };

        const eventIds = [
            eventCenter.attachDOMEvent(domNode!, 'click', clickHandler),
        ];

        this._eventIds.push(...eventIds);
    }

    update = (checked: boolean, source = 'api') => {
        const taskListItem = this.parent as TaskListItem;
        const taskList = taskListItem!.parent as TaskList;

        this._applyChecked(checked, source);

        // marktext `clickCtrl.js#listItemCheckBoxClick` cascaded a user toggle
        // through `muya.options.autoCheck`: checking/unchecking an item set the
        // same state on every descendant task item, then re-derived each
        // ancestor (checked iff all its siblings are checked). `source === 'api'`
        // is the silent, OT-free path used by the cascade itself, so it never
        // recurses.
        if (source !== 'api' && this.muya.options.autoCheck) {
            cascadeToDescendants(taskListItem, checked);
            rederiveAncestors(taskListItem);
        }

        taskList.orderIfNecessary();
    };

    // Reflect `checked` onto this checkbox's DOM and onto its task-list-item
    // state. A `user` source dispatches the OT `replace` op (via the
    // `TaskListItem.checked` setter); an `api` source mutates the state
    // silently so the cascade can update many items without op spam.
    private _applyChecked(checked: boolean, source: string) {
        this.syncDom(checked);

        const taskListItem = this.parent as TaskListItem;
        if (source === 'api')
            taskListItem.meta.checked = checked;
        else
            taskListItem.checked = checked;
    }

    // Sync only this checkbox's DOM + internal flag to `checked`. Used by the
    // autoCheck cascade, which has already mutated the owning item's state (and
    // dispatched the OT op) via the `TaskListItem.checked` setter, so this must
    // not touch state again.
    syncDom(checked: boolean) {
        this._checked = checked;
        operateClassName(
            this.domNode!,
            checked ? 'add' : 'remove',
            'mu-checkbox-checked',
        );

        if (isHTMLInputElement(this.domNode) && this.domNode.checked !== checked && !isFirefox)
            this.domNode.checked = checked;
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

export default TaskListCheckbox;
