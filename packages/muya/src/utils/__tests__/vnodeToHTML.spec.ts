// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { h, toHTML } from '../snabbdom';
import { vnodeToHTML } from '../vnodeToHTML';

describe('depth-safe VNode serialization', () => {
    it('preserves the existing serializer policy for inline nodes', () => {
        const node = h('span#id.one', {
            attrs: { title: '"<&', hidden: true },
            dataset: { raw: '<a href="x">' },
            class: { two: true, three: false },
            style: { color: 'red' },
        }, [
            h('a', { props: { href: '/a?b=1&c=2', title: '"<&' } }, 'link <&>'),
            h('br'),
            h('img', { attrs: { src: '/image.png' } }),
            h('span', { props: { innerHTML: '<b>trusted</b>' } }),
            h('!', 'comment'),
            h('svg', [h('g', [h('path', { attrs: { d: 'M0 0' } })])]),
            'raw <&> text',
        ]);
        expect(vnodeToHTML(node)).toBe(toHTML(node));
    });

    it('serializes 4000 nested nodes without recursion', () => {
        let node = h('span', 'x');
        for (let i = 0; i < 4000; i++)
            node = h('span', [node]);
        expect(vnodeToHTML(node)).toBe(`${'<span>'.repeat(4001)}x${'</span>'.repeat(4001)}`);
    });
});
