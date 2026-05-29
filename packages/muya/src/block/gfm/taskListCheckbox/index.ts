import type { Muya } from '../../../muya';
import type { ITaskListItemMeta } from '../../../state/types';
import type TaskList from '../taskList';
import type TaskListItem from '../taskListItem';
import { isFirefox } from '../../../config';
import { isHTMLInputElement, isMouseEvent } from '../../../utils';
import { operateClassName } from '../../../utils/dom';
import logger from '../../../utils/logger';
import TreeNode from '../../base/treeNode';

const debug = logger('tasklistCheckbox:');

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
        operateClassName(
            this.domNode!,
            checked ? 'add' : 'remove',
            'mu-checkbox-checked',
        );
        const taskListItem = this.parent as TaskListItem;
        const taskList = taskListItem!.parent as TaskList;

        if (isHTMLInputElement(this.domNode) && this.domNode.checked !== checked && !isFirefox)
            this.domNode.checked = checked;

        // No need to trigger the OT operation If the source is `api`.
        if (source === 'api')
            taskListItem.meta.checked = checked;
        else
            taskListItem.checked = checked;

        taskList.orderIfNecessary();
    };

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
