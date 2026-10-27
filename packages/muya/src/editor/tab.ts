import type Content from '../block/base/content';
import type Parent from '../block/base/parent';
import type { Muya } from '../muya';
import type { IAnchorFocusInfo, IResolvedTextSelection } from '../selection/types';
import { moveListItems } from '../block/listOperations';
import { convertIndentedParagraphs } from '../block/paragraphIndentation';
import { createTextSelectionState } from '../selection/state';
import { SelectionDirection } from '../selection/types';
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

function indentParagraphs(muya: Muya, selection: IResolvedTextSelection, start: IAnchorFocusInfo, end: IAnchorFocusInfo, shift: boolean) {
    const backward = selection.direction === SelectionDirection.BACKWARD;
    const contents: Content[] = [];
    let current: Content | null = start.block;
    while (current) {
        if (current.blockName !== 'paragraph.content' || current.parent?.parent !== start.block.parent?.parent)
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
    const updated = muya.editor.selection.getTextSelection();
    if (updated)
        convertIndentedParagraphs(contents, updated);
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
    const replacements = moveListItems(items, shift ? 'outdent' : 'indent');
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
