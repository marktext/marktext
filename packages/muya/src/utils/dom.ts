import type Content from '../block/base/content';
import type Parent from '../block/base/parent';
import type { IAttributes, IDatasets } from './types';
import { BLOCK_DOM_PROPERTY } from '../config';

interface ICreateDomOptions {
    classList: string[];
    attributes: IAttributes;
    datasets: IDatasets;
}

// Typed querySelector. Defaults to HTMLElement which is what almost every
// callsite wants; pass an explicit type parameter for anything more specific.
export function query<T extends Element = HTMLElement>(
    selector: string,
    parent: ParentNode = document,
): T | null {
    return parent.querySelector<T>(selector);
}

// Typed querySelectorAll, returning a plain array (most callers want to
// .map / .filter, not the live NodeList).
export function queryAll<T extends Element = HTMLElement>(
    selector: string,
    parent: ParentNode = document,
): T[] {
    return Array.from(parent.querySelectorAll<T>(selector));
}

// Read the Muya block stamped onto a DOM element. `BLOCK_DOM_PROPERTY` is a
// string property attached by `TreeNode.attachDOMNode`; centralising the
// cast here means callsites never need to reach into `element[KEY]` with
// `as` themselves.
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

/**
 * [description `add` or `remove` className of element
 */
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

// DOM operations
export function insertAfter(newNode: HTMLElement, originNode: HTMLElement) {
    const parentNode = originNode.parentNode;

    if (!parentNode)
        return;

    if (originNode.nextSibling)
        parentNode.insertBefore(newNode, originNode.nextSibling);
    else
        parentNode.appendChild(newNode);
}
