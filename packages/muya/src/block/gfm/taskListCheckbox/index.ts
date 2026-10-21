import type { Muya } from '../../../muya';
import type { ITaskListItemMeta } from '../../../state/types';
import type { Nullable } from '../../../types';
import type TaskList from '../taskList';
import type TaskListItem from '../taskListItem';
import { CLASS_NAMES, isFirefox } from '../../../config';
import { ChangeSource } from '../../../types';
import { isHTMLInputElement, isMouseEvent } from '../../../utils';
import { operateClassName } from '../../../utils/dom';
import logger from '../../../utils/logger';
import TreeNode from '../../base/treeNode';

const debug = logger('tasklistCheckbox:');

function isTaskListItem(node: Nullable<TreeNode>): node is TaskListItem {
    return !!node && node.blockName === 'task-list-item';
}

function isTaskList(node: Nullable<TreeNode>): node is TaskList {
    return !!node && node.blockName === 'task-list';
}

function isCheckbox(node: TreeNode): node is TaskListCheckbox {
    return node.blockName === TaskListCheckbox.blockName;
}

function checkboxOf(item: TaskListItem): TaskListCheckbox | null {
    let found: TaskListCheckbox | null = null;
    item.attachments.forEach((attachment) => {
        if (isCheckbox(attachment))
            found = attachment;
    });

    return found;
}

// Update the checked state and checkbox DOM; no-op when unchanged.
function setItemChecked(item: TaskListItem, checked: boolean): void {
    if (item.checked === checked)
        return;

    item.checked = checked;
    const checkbox = checkboxOf(item);
    if (checkbox)
        checkbox.syncDom(checked);
}

function nestedTaskListOf(item: TaskListItem): TaskList | null {
    let nested: TaskList | null = null;
    item.children.forEach((child: TreeNode) => {
        if (isTaskList(child))
            nested = child;
    });

    return nested;
}

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

function allSiblingsChecked(list: TaskList): boolean {
    let all = true;
    list.children.forEach((child: TreeNode) => {
        if (isTaskListItem(child) && !child.checked)
            all = false;
    });

    return all;
}

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

// Firefox needs a span because inputs are not clickable inside editable list items.
// Chromium keeps an input to avoid caret misalignment.
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

            this.classList.push(CLASS_NAMES.MU_CHECKBOX_CHECKED);
        }

        this.createDomNode();
        this.listen();
    }

    listen() {
        const { domNode, muya } = this;
        const { eventCenter } = muya;
        const clickHandler = (event: Event) => {
            if (this.muya.isReadOnly) {
                event.preventDefault();
                return;
            }
            if (!isMouseEvent(event))
                return;

            event.stopPropagation();

            if (isFirefox) {
                this._checked = !this._checked;

                this.update(this._checked, ChangeSource.User);
            }
            else if (isHTMLInputElement(event.target)) {
                const { checked } = event.target;
                this._checked = checked;
                this.update(checked, ChangeSource.User);
            }

            // The control is not editable, so clicking it does not move the
            // text selection. Seat the caret in this item before the desktop's
            // selection-follow scroll can reveal a stale off-screen cursor.
            (this.parent as TaskListItem).firstContentInDescendant()?.setCursor(0, 0, true);
        };

        const eventIds = [
            eventCenter.attachDOMEvent(domNode!, 'click', clickHandler),
        ];

        this._eventIds.push(...eventIds);
    }

    update = (checked: boolean, source: ChangeSource = ChangeSource.Api) => {
        if (!this.muya.canMutate)
            return;
        const taskListItem = this.parent as TaskListItem;
        const taskList = taskListItem!.parent as TaskList;

        this._applyChecked(checked, source);

        // Only user changes cascade; Api updates synchronize silently without recursive edits.
        if (source !== ChangeSource.Api && this.muya.options.autoCheck) {
            cascadeToDescendants(taskListItem, checked);
            rederiveAncestors(taskListItem);
        }

        taskList.orderIfNecessary();
    };

    // User updates dispatch an OT operation; Api updates synchronize state silently.
    private _applyChecked(checked: boolean, source: ChangeSource) {
        this.syncDom(checked);

        const taskListItem = this.parent as TaskListItem;
        if (source === ChangeSource.Api)
            taskListItem.meta.checked = checked;
        else
            taskListItem.checked = checked;
    }

    // Update DOM only: the cascade has already changed state and dispatched its operation.
    syncDom(checked: boolean) {
        this._checked = checked;
        operateClassName(
            this.domNode!,
            checked ? 'add' : 'remove',
            CLASS_NAMES.MU_CHECKBOX_CHECKED,
        );

        if (isHTMLInputElement(this.domNode) && this.domNode.checked !== checked && !isFirefox)
            this.domNode.checked = checked;
    }

    private _detachDOMEvents() {
        for (const id of this._eventIds)
            this.muya.eventCenter.detachDOMEvent(id);
    }

    override remove(_source: ChangeSource) {
        super.remove();
        this._detachDOMEvents();

        return this;
    }

    getState() {
        debug.warn('You should never call this method.');
    }
}

export default TaskListCheckbox;
