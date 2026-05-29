import type { Muya } from '../../../muya';
import type { ITaskListMeta, ITaskListState } from '../../../state/types';
import type TaskListItem from '../taskListItem';
import { mixins } from '../../../utils';
import Parent from '../../base/parent';
import IContainerQueryBlock from '../../mixins/containerQueryBlock';
import { ScrollPage } from '../../scrollPage';

@mixins(IContainerQueryBlock)
class TaskList extends Parent {
    public meta: ITaskListMeta;

    static override blockName = 'task-list';

    static create(muya: Muya, state: ITaskListState) {
        const taskList = new TaskList(muya, state);

        taskList.append(
            ...state.children.map(child =>
                ScrollPage.loadBlock(child.name).create(muya, child),
            ),
        );

        return taskList;
    }

    override get path() {
        const { path: pPath } = this.parent!;
        const offset = this.parent!.offset(this);

        return [...pPath, offset, 'children'];
    }

    constructor(muya: Muya, { meta }: ITaskListState) {
        super(muya);
        this.tagName = 'ul';
        this.meta = meta;
        this.datasets = {
            marker: meta.marker,
        };
        this.classList = ['mu-task-list'];
        if (!meta.loose)
            this.classList.push('mu-tight-list');

        this.createDomNode();
    }

    /**
     * Auto move checked list item to the end of task list.
     */
    orderIfNecessary() {
        const { autoMoveCheckedToEnd } = this.muya.options;
        if (!autoMoveCheckedToEnd)
            return;

        let first = this.firstChild as TaskListItem;
        let last = this.lastChild as TaskListItem;
        let anchor = first;

        while (first !== last) {
            if (!first.checked) {
                first = first.next as TaskListItem;
                anchor = first;
            }
            else if (last.checked) {
                last = last.prev as TaskListItem;
            }
            else {
                const temp = last;
                last = last.prev as TaskListItem;
                temp.insertInto(this, anchor);
                anchor = temp;
            }
        }
    }

    override getState(): ITaskListState {
        const state: ITaskListState = {
            name: 'task-list',
            meta: { ...this.meta },
            children: this.children.map(child => (child as TaskListItem).getState()),
        };

        return state;
    }
}

export default TaskList;
