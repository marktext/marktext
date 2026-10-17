import type { IAnchorFocusInfo } from '../selection/types';
import type { TState } from '../state/types';
import type Parent from './base/parent';
import { githubAlertBlockType, githubAlertType, matchGithubAlertMarker } from '../utils/githubAlerts';

export function canConvertGithubAlert(block: Parent, label: string): boolean {
    if (!block.muya.options.githubAlerts || !block.parent?.isScrollPage)
        return false;
    const state = block.getState();
    if (state.name === 'block-quote' && state.meta?.style === 'fenced')
        return false;
    if (label.startsWith('github-alert '))
        return !!githubAlertType(label.slice('github-alert '.length)) && ['paragraph', 'block-quote', 'github-alert'].includes(state.name);
    if (label === 'paragraph')
        return state.name === 'github-alert' || state.name === 'block-quote';
    if (label !== 'block-quote')
        return false;
    if (state.name === 'paragraph')
        return true;
    if (state.name !== 'github-alert')
        return false;
    const first = state.children[0];
    if (first?.name !== 'paragraph' || !matchGithubAlertMarker(first.text.split('\n', 1)[0]))
        return true;
    const quote: TState = { name: 'block-quote', children: state.children };
    const parsed = block.muya.editor.jsonState.markdownToState(`${block.jsonState.getMarkdownFromState([quote])}\n${Array.from(block.muya.editor.inlineRenderer.labels, ([label, info]) => `[${label}]: <${info.href}>`).join('\n')}`);
    return parsed[0]?.name !== 'github-alert';
}

function conversionBody(block: Parent, state: TState, text?: string) {
    const container = state.name === 'block-quote' || state.name === 'github-alert';
    let children = container ? state.children : [text === undefined ? state : { name: 'paragraph' as const, text }];
    const marker = state.name === 'block-quote' && children[0]?.name === 'paragraph'
        && matchGithubAlertMarker(children[0].text) && !block.firstChild?.domNode?.querySelector('a');
    if (marker)
        children = children.slice(1);
    if (!children.length)
        children = [{ name: 'paragraph', text: '' }];
    return { container, children, marker };
}

export function convertGithubAlert(block: Parent, label: string, text?: string): boolean {
    if (!canConvertGithubAlert(block, label))
        return false;
    const { muya } = block;
    muya.flush();
    const state = block.getState();
    const type = label.startsWith('github-alert ') ? githubAlertType(label.slice('github-alert '.length)) : null;
    if (type && githubAlertBlockType(block) === type)
        return true;
    const { container, children, marker } = conversionBody(block, state, text);
    // A separating blank line prevents ordered lists from folding into the marker paragraph.
    const separate = children[0]?.name !== 'paragraph' || (state.name === 'github-alert' && state.meta.compact === false);
    let replacement: TState[];
    if (label === 'paragraph')
        replacement = children;
    else if (type)
        replacement = [{ name: 'github-alert', meta: { type, ...(separate ? { compact: false } : {}) }, children }];
    else
        replacement = [{ name: 'block-quote', children }];
    const selection = muya.editor.selection.getSelection();
    const index = block.parent!.offset(block);
    muya.editor.scrollPage!.replaceBlock(block, replacement);
    const resolve = (endpoint: IAnchorFocusInfo) => {
        const child = container ? Math.max(0, Number(endpoint.path[2]) - (marker ? 1 : 0)) : 0;
        const tail = container ? endpoint.path.slice(3) : endpoint.path.slice(1);
        const path = label === 'paragraph' ? [index + child, ...tail] : [index, 'children', child, ...tail];
        return { path, offset: endpoint.offset };
    };
    if (!muya.editor.selection.restore(selection && { ...selection, anchor: resolve(selection.anchor), focus: resolve(selection.focus) })) {
        const target = muya.editor.scrollPage!.find(index);
        if (target?.isParent())
            target.firstContentInDescendant()?.setCursor(0, 0, true);
    }
    return true;
}
