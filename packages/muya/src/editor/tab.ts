import type Content from '../block/base/content';
import type Parent from '../block/base/parent';
import type { Muya } from '../muya';
import type { IAnchorFocusInfo, IResolvedTextSelection } from '../selection/types';
import { ScrollPage } from '../block/scrollPage';
import { createTextSelectionState } from '../selection/state';
import { SelectionDirection } from '../selection/types';
import { isAnyListState } from '../state/types';
import { ChangeSource } from '../types';
import { editTab } from '../utils/tab';

function listItem(content: Content): Parent | null {
    let item = content.parent;
    while (item) {
        if (item.blockName === 'list-item' || item.blockName === 'task-list-item')
            return item;
        item = item.parent;
    }
    return null;
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
            ...state.meta,
            ...('start' in state.meta ? { start: state.meta.start + firstIndex } : {}),
        },
        children: [],
    }) as Parent;
    lifted.append(...clones);
    const container = outer.parent!;
    container.insertAfter(lifted, outer);
    if (tail.length) {
        const start = 'start' in outerState.meta ? outerState.meta.start + outer.offset(owner) + 1 : undefined;
        const after = ScrollPage.loadBlock(outer.blockName).create(list.muya, {
            ...outerState,
            meta: { ...outerState.meta, ...(start !== undefined ? { start } : {}) },
            children: tail.map(item => item.getState()),
        }) as Parent;
        tail.forEach(item => item.remove());
        container.insertAfter(after, lifted);
    }
}

function moveItems(items: Parent[], shift: boolean): Map<Content, Content> | null {
    const list = items[0].parent!;
    const listState = list.getState();
    if (listState.name !== 'bullet-list' && listState.name !== 'order-list' && listState.name !== 'task-list')
        return null;
    const replacements = new Map<Content, Content>();
    const firstIndex = list.offset(items[0]);
    if (!shift) {
        const previous = items[0].prev;
        if (!previous)
            return null;
        let target = previous.lastChild as Parent | null;
        if (target?.blockName !== list.blockName) {
            target = ScrollPage.loadBlock(list.blockName).create(list.muya, { ...listState, children: [] }) as Parent;
            previous.append(target, ChangeSource.User);
        }
        target.append(...items.map(item => cloneItem(item, replacements)), ChangeSource.User);
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
            const nested = ScrollPage.loadBlock(list.blockName).create(list.muya, {
                ...listState,
                meta: {
                    ...listState.meta,
                    ...('start' in listState.meta ? { start: listState.meta.start + list.offset(tail[0]) } : {}),
                },
                children: [],
            }) as Parent;
            nested.append(...tail.map(item => cloneItem(item, replacements)));
            last.append(nested);
            tail.forEach(item => item.remove());
        }
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

function indentParagraphs(muya: Muya, selection: IResolvedTextSelection, start: IAnchorFocusInfo, end: IAnchorFocusInfo, shift: boolean) {
    const backward = selection.direction === SelectionDirection.BACKWARD;
    const contents: Content[] = [];
    let current: Content | null = start.block;
    while (current) {
        if (current.blockName !== 'paragraph.content')
            return;
        contents.push(current);
        if (current === end.block)
            break;
        current = current.nextContentInContext() ?? null;
    }
    if (current !== end.block)
        return;
    let anchorOffset = selection.anchor.offset;
    let focusOffset = selection.focus.offset;
    for (const content of contents) {
        const from = content === start.block ? start.offset : 0;
        const to = content === end.block ? end.offset : content.text.length;
        if (content === end.block && to === 0)
            continue;
        const edit = editTab(content.text, from, to, muya.options.tabSize, shift, true);
        content.text = edit.text;
        content.update();
        if (content === selection.anchor.block)
            anchorOffset = backward ? edit.focus : edit.anchor;
        if (content === selection.focus.block)
            focusOffset = backward ? edit.anchor : edit.focus;
    }
    muya.editor.selection.setSelection(createTextSelectionState(
        { ...selection.anchor, offset: anchorOffset },
        { ...selection.focus, offset: focusOffset },
    ));
}

function indentListSelection(muya: Muya, selection: IResolvedTextSelection, first: Parent, last: Parent, end: IAnchorFocusInfo, shift: boolean) {
    if (first.parent !== last.parent)
        return;
    const items: Parent[] = [];
    for (let item: Parent | null = first; item; item = item.next ?? null) {
        if (item === last && end.offset === 0 && end.block === last.firstContentInDescendant())
            break;
        items.push(item);
        if (item === last)
            break;
    }
    if (!items.length)
        return;
    const replacements = moveItems(items, shift);
    if (!replacements)
        return;
    const anchor = replacements.get(selection.anchor.block) ?? selection.anchor.block;
    const focus = replacements.get(selection.focus.block) ?? selection.focus.block;
    muya.editor.selection.setSelection(createTextSelectionState(
        { block: anchor, path: anchor.path, offset: selection.anchor.offset },
        { block: focus, path: focus.path, offset: selection.focus.offset },
    ));
}

export function shouldHandleTabSelection(selection: IResolvedTextSelection | null): selection is IResolvedTextSelection {
    return !!selection && (!selection.isSelectionInSameBlock || (!selection.isCollapsed
        && selection.anchor.block.blockName === 'paragraph.content'
        && ['list-item', 'task-list-item'].includes(selection.anchor.block.parent?.parent?.blockName ?? '')));
}

export function handleTabSelection(muya: Muya, event: KeyboardEvent, selection: IResolvedTextSelection): void {
    event.preventDefault();
    const backward = selection.direction === SelectionDirection.BACKWARD;
    const start = backward ? selection.focus : selection.anchor;
    const end = backward ? selection.anchor : selection.focus;
    const first = listItem(start.block);
    const last = listItem(end.block);
    if (first || last) {
        if (first && last)
            indentListSelection(muya, selection, first, last, end, event.shiftKey);
    }
    else {
        indentParagraphs(muya, selection, start, end, event.shiftKey);
    }
}
