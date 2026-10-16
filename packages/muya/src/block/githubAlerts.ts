import type { Muya } from '../muya';
import type { IAnchorFocusInfo } from '../selection/types';
import type { TState } from '../state/types';
import type Content from './base/content';
import type Parent from './base/parent';
import type BlockQuote from './commonMark/blockQuote';
import { githubAlertBlockMarker, githubAlertBlockType, githubAlertBody, githubAlertIcon, githubAlertStateType, githubAlertTitle, githubAlertType, splitGithubAlertMarker } from '../utils/githubAlerts';

export function refreshGithubAlerts(muya: Muya, page = muya.editor.scrollPage) {
    if (!page)
        return;
    page.forEach((node) => {
        if (!node.isParent() || node.blockName !== 'block-quote')
            return;
        const quote = node as BlockQuote;
        const dom = node.domNode!;
        if (!muya.options.githubAlerts && !quote.meta?.alertCompact && !dom.classList.contains('mu-github-alert'))
            return;
        const type = githubAlertBlockType(node);
        dom.classList.toggle('mu-github-alert', !!type);
        if (type)
            dom.dataset.alertType = type.toLowerCase();
        else
            delete dom.dataset.alertType;
        let title = dom.querySelector<HTMLElement>(':scope > .mu-alert-title');
        if (type) {
            if (!title) {
                title = document.createElement('div');
                title.className = 'mu-alert-title';
                title.contentEditable = 'false';
                dom.prepend(title);
            }
            if (title.dataset.type !== type) {
                title.innerHTML = githubAlertIcon(type);
                title.append(githubAlertTitle(type));
                title.dataset.type = type;
            }
        }
        else {
            title?.remove();
        }
        const first = node.firstChild;
        if (first?.isParent()) {
            first.domNode!.hidden = !!type;
            first.domNode!.classList.toggle('mu-alert-source', !!quote.meta?.alertCompact && !type);
        }
    });
}

export function canConvertGithubAlert(block: Parent, label: string): boolean {
    if (!block.muya.options.githubAlerts || !block.parent?.isScrollPage)
        return false;
    const name = block.blockName;
    if (label.startsWith('github-alert '))
        return !!githubAlertType(label.slice('github-alert '.length)) && (name === 'paragraph' || (name === 'block-quote' && (block as BlockQuote).meta?.style !== 'fenced'));
    if (name === 'paragraph' && label === 'block-quote')
        return true;
    if (name !== 'block-quote' || (label !== 'paragraph' && label !== 'block-quote'))
        return false;
    if (label === 'block-quote') {
        if (!githubAlertBlockType(block))
            return false;
        const state = (block as BlockQuote).getState();
        const body = githubAlertBody(state);
        return !githubAlertStateType(splitGithubAlertMarker({ ...state, children: body }), true);
    }
    return true;
}

function conversionBody(state: TState, hadMarker: boolean, text?: string) {
    if (state.name !== 'block-quote')
        return { body: [text === undefined ? state : { name: 'paragraph' as const, text }], joinedPrefix: 0 };
    const body = hadMarker ? state.children.slice(1) : state.children;
    if (!hadMarker && state.meta?.alertCompact && body[0]?.name === 'paragraph' && body[1]?.name === 'paragraph') {
        return {
            joinedPrefix: body[0].text.length + 1,
            body: [{ name: 'paragraph' as const, text: `${body[0].text}\n${body[1].text}` }, ...body.slice(2)],
        };
    }
    return { body, joinedPrefix: 0 };
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
    const hadMarker = !!githubAlertBlockMarker(block);
    const { body, joinedPrefix } = conversionBody(state, hadMarker, text);
    const children = body.length ? body : [{ name: 'paragraph' as const, text: '' }];
    const replacement: TState[] = label === 'paragraph'
        ? children
        : [{
                name: 'block-quote',
                ...(type ? { meta: { alertCompact: true } } : {}),
                children: type ? [{ name: 'paragraph', text: `[!${type}]` }, ...children] : children,
            }];
    const selection = muya.editor.selection.getSelection();
    const index = block.parent!.offset(block);
    muya.editor.scrollPage!.replaceBlock(block, replacement);
    const resolve = (endpoint: IAnchorFocusInfo) => {
        const child = state.name === 'block-quote' ? Number(endpoint.path[2]) : 0;
        const bodyIndex = Math.max(0, child - (hadMarker || joinedPrefix ? 1 : 0));
        const tail = state.name === 'block-quote' ? endpoint.path.slice(3) : endpoint.path.slice(1);
        const path = label === 'paragraph'
            ? [index + bodyIndex, ...tail]
            : [index, 'children', bodyIndex + (type ? 1 : 0), ...tail];
        const content = muya.editor.scrollPage!.queryBlock([...path]);
        return content?.isContent() ? { block: content, path, offset: Math.min(endpoint.offset + (joinedPrefix && child === 1 ? joinedPrefix : 0), content.text.length) } : null;
    };
    const anchor = selection && resolve(selection.anchor);
    const focus = selection && resolve(selection.focus);
    if (anchor && focus) {
        muya.editor.activeContentBlock = anchor.block;
        muya.editor.selection.setSelection(anchor, focus);
    }
    else {
        const target = muya.editor.scrollPage!.find(index);
        if (target?.isParent())
            target.firstContentInDescendant()?.setCursor(0, 0, true);
    }
    return true;
}

export function downgradeGithubAlertAtStart(content: Content, event: Event & Partial<Pick<KeyboardEvent, 'metaKey' | 'ctrlKey' | 'altKey'>>): boolean {
    if (event.metaKey || event.ctrlKey || event.altKey)
        return false;
    const quote = content.outMostBlock;
    if (!quote || !githubAlertBlockType(quote))
        return false;
    const body = quote.find(1);
    let first = body?.isParent() ? body.firstContentInDescendant() : null;
    if (first?.blockName === 'language-input')
        first = first.nextContentInContext() ?? null;
    const cursor = content.getCursor();
    if (first !== content || cursor?.start.offset !== 0 || cursor.end.offset !== 0)
        return false;
    event.preventDefault();
    event.stopPropagation();
    convertGithubAlert(quote, 'block-quote');
    return true;
}
