import type { IAnchorFocusInfo } from '../selection/types';
import type { IGithubAlertState, TState } from '../state/types';
import type Parent from './base/parent';
import { githubAlertBlockType, githubAlertType, matchGithubAlertMarker } from '../utils/githubAlerts';

function alertTypeFromLabel(label: string) {
    return label.startsWith('github-alert ') ? githubAlertType(label.slice('github-alert '.length)) : null;
}

export function canConvertGithubAlert(block: Parent, label: string): boolean {
    if (!block.muya.options.githubAlerts || !block.parent?.isScrollPage)
        return false;
    const state = block.getState();
    if (state.name !== 'paragraph' && state.name !== 'block-quote' && state.name !== 'github-alert')
        return false;
    if (state.name === 'block-quote' && state.meta?.style === 'fenced')
        return false;

    switch (label) {
        case 'paragraph':
            return state.name !== 'paragraph';
        case 'block-quote':
            return state.name === 'paragraph' || state.name === 'github-alert';
        default:
            return alertTypeFromLabel(label) !== null;
    }
}

function replacementStates(source: TState, children: TState[], label: string): TState[] {
    if (label === 'paragraph')
        return children;
    const type = alertTypeFromLabel(label);
    if (!type)
        return [{ name: 'block-quote', children }];

    const alert: IGithubAlertState = { name: 'github-alert', meta: { type }, children };
    // Keep a blank line before structured bodies so ordered lists remain lists.
    if (children[0].name !== 'paragraph' || (source.name === 'github-alert' && source.meta.blankLineAfterMarker))
        alert.meta.blankLineAfterMarker = true;
    return [alert];
}

export function convertGithubAlert(block: Parent, label: string, text?: string): boolean {
    if (!canConvertGithubAlert(block, label))
        return false;
    const { muya } = block;
    muya.flush();
    const state = block.getState();
    const type = alertTypeFromLabel(label);
    if (type && githubAlertBlockType(block) === type)
        return true;
    const isContainer = 'children' in state;
    let children: TState[] = isContainer ? state.children : [state];
    if (!isContainer && text !== undefined)
        children = [{ name: 'paragraph', text }];
    const removeMarker = state.name === 'block-quote' && children[0]?.name === 'paragraph'
        && !!matchGithubAlertMarker(children[0].text) && !block.firstChild?.domNode?.querySelector('a');
    if (removeMarker)
        children = children.slice(1);
    if (!children.length)
        children = [{ name: 'paragraph', text: '' }];

    const selection = muya.editor.selection.getSelection();
    const index = block.parent!.offset(block);
    const replacements = muya.editor.scrollPage!.replaceBlock(block, replacementStates(state, children, label));
    const remap = (point: IAnchorFocusInfo) => {
        const bodyIndex = isContainer ? Math.max(0, Number(point.path[2]) - Number(removeMarker)) : 0;
        const contentPath = point.path.slice(isContainer ? 3 : 1);
        const path = label === 'paragraph' ? [index + bodyIndex, ...contentPath] : [index, 'children', bodyIndex, ...contentPath];
        const content = muya.editor.scrollPage!.queryBlock([...path]);
        return content?.isContent() ? { block: content, path, offset: Math.min(point.offset, content.text.length) } : null;
    };
    if (selection) {
        const anchor = remap(selection.anchor);
        const focus = remap(selection.focus);
        if (anchor && focus) {
            muya.editor.activeContentBlock = anchor.block;
            muya.editor.selection.setSelection(anchor, focus);
            return true;
        }
    }
    replacements[0]?.firstContentInDescendant()?.setCursor(0, 0, true);
    return true;
}
