import type Content from '../block/base/content';
import type Parent from '../block/base/parent';
import type { IAttributes, IDatasets } from './types';
import { BLOCK_DOM_PROPERTY } from '../config';

interface ICreateDomOptions {
    classList: string[];
    attributes: IAttributes;
    datasets: IDatasets;
}

export function query<T extends Element = HTMLElement>(
    selector: string,
    parent: ParentNode = document,
): T | null {
    return parent.querySelector<T>(selector);
}

export function queryAll<T extends Element = HTMLElement>(
    selector: string,
    parent: ParentNode = document,
): T[] {
    return Array.from(parent.querySelectorAll<T>(selector));
}

// Embedders may scroll the editor itself or an ancestor; fall back to document scrolling.
export function findScrollContainer(node: HTMLElement): HTMLElement {
    let el: HTMLElement | null = node;
    while (el && el !== document.body && el !== document.documentElement) {
        const { overflowY } = getComputedStyle(el);
        if (overflowY === 'auto' || overflowY === 'scroll')
            return el;

        el = el.parentElement;
    }

    return node;
}

// Read the block reference stamped on rendered DOM elements.
export function getBlock(el: Element | null | undefined): Parent | Content | undefined {
    if (!el)
        return undefined;
    // `BLOCK_DOM_PROPERTY` is a string key (`__MUYA_BLOCK__`) that
    // `TreeNode.attachDOMNode` stamps onto rendered elements. The DOM types
    // can't express the project-specific property, so the lookup is widened
    // to `Record<string, …>` here once for all callers.
    // eslint-disable-next-line no-restricted-syntax
    const block = (el as unknown as Record<string, Parent | Content | undefined>)[BLOCK_DOM_PROPERTY];
    return block;
}

export function createDomNode(tagName: string, { classList = [], attributes = {}, datasets = {} }: ICreateDomOptions = {} as ICreateDomOptions) {
    const domNode = document.createElement(tagName);

    for (const className of classList)
        domNode.classList.add(className);

    for (const [key, value] of Object.entries(attributes))
        domNode.setAttribute(key, value.toString());

    for (const [key, value] of Object.entries(datasets))
        domNode.dataset[key] = value.toString();

    return domNode;
}

export function operateClassName(element: HTMLElement, ctrl: 'add' | 'remove', className: string) {
    const existed = element.classList.contains(className);

    if ((ctrl === 'add' && !existed) || (ctrl === 'remove' && existed))
        element.classList[ctrl](className);
}

export function insertBefore(newNode: HTMLElement, originNode: HTMLElement) {
    const parentNode = originNode.parentNode;
    if (parentNode)
        parentNode.insertBefore(newNode, originNode);
}

export function insertAfter(newNode: HTMLElement, originNode: HTMLElement) {
    const parentNode = originNode.parentNode;

    if (!parentNode)
        return;

    if (originNode.nextSibling)
        parentNode.insertBefore(newNode, originNode.nextSibling);
    else
        parentNode.appendChild(newNode);
}
