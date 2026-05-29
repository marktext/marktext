import {
    attributesModule,
    classModule,
    datasetModule,
    eventListenersModule,
    init,
    propsModule,
    h as sh,
    toVNode as sToVNode,
    styleModule,
} from 'snabbdom';
import sToHTML from 'snabbdom-to-html';

export const patch = init([
    classModule,
    attributesModule,
    styleModule,
    propsModule,
    datasetModule,
    eventListenersModule,
]);

export const h = sh;
export const toVnode = sToVNode;

export const toHTML = sToHTML; // helper function for convert vnode to HTML string
export function htmlToVNode(html: string) {
    // helper function for convert html to vnode
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;

    return toVnode(wrapper).children;
}
