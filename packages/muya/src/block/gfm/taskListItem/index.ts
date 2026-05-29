import type { Muya } from '../../../muya';
import type { ITaskListItemMeta, ITaskListItemState } from '../../../state/types';
import type { TBlockPath } from '../../types';
import { mixins } from '../../../utils';
import { LinkedList } from '../../base/linkedList/linkedList';
import Parent from '../../base/parent';
import IContainerQueryBlock from '../../mixins/containerQueryBlock';
import { ScrollPage } from '../../scrollPage';

@mixins(IContainerQueryBlock)
class TaskListItem extends Parent {
    override children: LinkedList<Parent> = new LinkedList();

    meta: ITaskListItemMeta;

    static override blockName = 'task-list-item';

    static create(muya: Muya, state: ITaskListItemState) {
        const listItem = new TaskListItem(muya, state);

        listItem.appendAttachment(
            ScrollPage.loadBlock('task-list-checkbox').create(muya, state.meta),
        );

        listItem.append(
            ...state.children.map(child =>
                ScrollPage.loadBlock(child.name).create(muya, child),
            ),
        );

        return listItem;
    }

    override get path(): TBlockPath {
        const { path: pPath } = this.parent!;
        const offset = this.parent!.offset(this);

        return [...pPath, offset, 'children'];
    }

    get checked() {
        return this.meta.checked;
    }

    set checked(checked) {
        const oldCheckStatus = this.meta.checked;

        if (checked !== oldCheckStatus) {
            this.meta.checked = checked;
            const { path } = this;
            path.pop();
            path.push('meta', 'checked');

            this.jsonState.replaceOperation(path, oldCheckStatus, checked);
        }
    }

    constructor(muya: Muya, { meta }: ITaskListItemState) {
        super(muya);
        this.tagName = 'li';
        this.meta = meta;
        this.classList = ['mu-task-list-item'];
        this.createDomNode();
    }

    override getState(): ITaskListItemState {
        const state: ITaskListItemState = {
            name: 'task-list-item',
            meta: { ...this.meta },
            children: this.children.map(child => child.getState()),
        };

        return state;
    }
}

export default TaskListItem;
