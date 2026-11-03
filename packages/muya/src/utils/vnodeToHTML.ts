import type { VNode } from 'snabbdom';
import { toHTML } from './snabbdom';

/** Inline VNodes are materialized; reuse serializer policy without recursive descendant calls. */
export function vnodeToHTML(root: VNode): string {
    const stack: (VNode | string)[] = [root];
    const parts: string[] = [];
    while (stack.length) {
        const node = stack.pop()!;
        if (typeof node === 'string') {
            parts.push(node);
            continue;
        }
        if (!node.children?.length || node.text || node.data?.props?.innerHTML || node.sel === '!') {
            parts.push(toHTML(node));
            continue;
        }
        const shell = toHTML({ ...node, children: undefined });
        const close = shell.lastIndexOf('</');
        if (close < 0) {
            parts.push(shell);
            continue;
        }
        parts.push(shell.slice(0, close));
        stack.push(shell.slice(close));
        for (let i = node.children.length - 1; i >= 0; i--) {
            const child = node.children[i];
            stack.push(typeof child === 'string'
                ? { sel: undefined, data: undefined, children: undefined, elm: undefined, text: child, key: undefined }
                : child);
        }
    }
    return parts.join('');
}
