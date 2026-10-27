import type { IBulletListState, IOrderListState, ITaskListState } from '../state/types';
import type Content from './base/content';
import type Parent from './base/parent';
import { isAnyListState } from '../state/types';
import { ChangeSource } from '../types';
import { ScrollPage } from './scrollPage';

type TListState = IBulletListState | IOrderListState | ITaskListState;

function listMarker(state: TListState): string {
    return 'delimiter' in state.meta ? state.meta.delimiter : state.meta.marker;
}

function listMetaAt(state: TListState, index: number) {
    return { ...state.meta, ...('start' in state.meta ? { start: state.meta.start + index } : {}) };
}

function indentItems(items: Parent[], previous: Parent, state: TListState, replacements: Map<Content, Content>): void {
    let target = previous.lastChild as Parent | null;
    const previousState = target?.getState();
    // Task items require task-list owners even when Markdown markers match (#5349).
    if (!previousState || !isAnyListState(previousState)
        || (previousState.name === 'task-list') !== (items[0].blockName === 'task-list-item')) {
        // Adjacent lists with the same Markdown marker share their looseness.
        const loose = previousState && isAnyListState(previousState) && listMarker(previousState) === listMarker(state)
            ? previousState.meta.loose
            : state.meta.loose;
        target = ScrollPage.loadBlock(state.name).create(previous.muya, {
            ...state,
            meta: { ...state.meta, loose },
            children: [],
        }) as Parent;
        previous.append(target, ChangeSource.User);
    }
    target!.append(...items.map(item => cloneItem(item, replacements)), ChangeSource.User);
}

function cloneItem(item: Parent, replacements: Map<Content, Content>): Parent {
    const state = item.getState();
    const clone = ScrollPage.loadBlock(item.blockName).create(item.muya, state) as Parent;
    const pair = (original: Parent, copy: Parent) => {
        original.forEach((child, index) => {
            const other = copy.find(index);
            if (!other)
                return;
            if (child.isContent() && other.isContent())
                replacements.set(child, other);
            else if (child.isParent() && other.isParent())
                pair(child, other);
        });
    };
    pair(item, clone);
    return clone;
}

function liftItems(list: Parent, owner: Parent, clones: Parent[], firstIndex: number) {
    const outer = owner.parent!;
    if (owner.blockName === clones[0].blockName) {
        let reference = owner;
        for (const clone of clones) {
            outer.insertAfter(clone, reference);
            reference = clone;
        }
        return;
    }
    const state = list.getState();
    const outerState = outer.getState();
    if (!isAnyListState(state) || !isAnyListState(outerState))
        return;
    const tail: Parent[] = [];
    for (let next = owner.next; next; next = next.next)
        tail.push(next);
    const following = outer.next;
    const followingState = following?.getState();
    if (!tail.length && following && followingState && isAnyListState(followingState)
        && following.blockName === list.blockName
        && 'marker' in followingState.meta && 'marker' in state.meta
        && followingState.meta.marker === state.meta.marker) {
        const reference = following.firstChild as Parent;
        for (const clone of clones)
            following.insertBefore(clone, reference);
        return;
    }
    const lifted = ScrollPage.loadBlock(list.blockName).create(list.muya, {
        ...state,
        meta: {
            ...listMetaAt(state, firstIndex),
            loose: listMarker(outerState) === listMarker(state) ? outerState.meta.loose : state.meta.loose,
        },
        children: [],
    }) as Parent;
    lifted.append(...clones);
    const container = outer.parent!;
    container.insertAfter(lifted, outer);
    if (tail.length) {
        const after = ScrollPage.loadBlock(outer.blockName).create(list.muya, {
            ...outerState,
            meta: listMetaAt(outerState, outer.offset(owner) + 1),
            children: tail.map(item => item.getState()),
        }) as Parent;
        tail.forEach(item => item.remove());
        container.insertAfter(after, lifted);
    }
}

// Callers supply contiguous siblings and own the transaction. Leaf replacements
// let them restore cursors/selections after nodes are recreated.
export function moveListItems(items: Parent[], direction: 'indent' | 'outdent'): Map<Content, Content> | null {
    const list = items[0]?.parent;
    if (!list)
        return null;
    const listState = list.getState();
    if (!isAnyListState(listState))
        return null;
    const replacements = new Map<Content, Content>();
    const firstIndex = list.offset(items[0]);
    if (direction === 'indent') {
        const previous = items[0].prev;
        if (!previous)
            return null;
        indentItems(items, previous, listState, replacements);
    }
    else {
        const owner = list.parent;
        if (!owner || !owner.parent || (owner.blockName !== 'list-item' && owner.blockName !== 'task-list-item'))
            return null;
        const clones = items.map(item => cloneItem(item, replacements));
        const last = clones.at(-1)!;
        const tail: Parent[] = [];
        for (let next = items.at(-1)!.next; next; next = next.next)
            tail.push(next);
        if (tail.length) {
            let nested = last.lastChild as Parent | null;
            if (nested?.blockName !== list.blockName) {
                nested = ScrollPage.loadBlock(list.blockName).create(list.muya, {
                    ...listState,
                    meta: listMetaAt(listState, list.offset(tail[0])),
                    children: [],
                }) as Parent;
                last.append(nested);
            }
            nested.append(...tail.map(item => cloneItem(item, replacements)));
            tail.forEach(item => item.remove());
        }
        // Following blocks belong to the owner item, not its nested list (#4899).
        const trailing: Parent[] = [];
        for (let next = list.next; next; next = next.next)
            trailing.push(next);
        last.append(...trailing.map(block => cloneItem(block, replacements)));
        trailing.forEach(block => block.remove());
        liftItems(list, owner, clones, firstIndex);
    }
    items.forEach(item => item.remove());
    if (!list.length())
        list.remove();
    return replacements;
}
