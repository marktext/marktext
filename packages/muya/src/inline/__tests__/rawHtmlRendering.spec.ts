// @vitest-environment jsdom

import type Format from '../../block/base/format';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../muya';
import { tokenizer } from '../lexer';

let muya: Muya;

beforeEach(() => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    muya = new Muya(host, { markdown: 'text' });
    muya.init();
});

afterEach(() => {
    muya.destroy();
    document.body.innerHTML = '';
});

function render(source: string): string {
    const block = new Proxy(muya.editor.scrollPage!.firstContentInDescendant()! as Format, {
        get: (target, key, receiver) => key === 'text' ? source : Reflect.get(target, key, receiver),
    });
    return muya.editor.inlineEngine.renderer.output(
        tokenizer(source, { profile: 'inline' }),
        block,
        {},
    );
}

describe('raw HTML rendering depth and ownership', () => {
    it('renders 4000 nested spans with linear output size', () => {
        const source = `${'<span>'.repeat(4000)}x${'</span>'.repeat(4000)}`;
        const output = render(source);
        expect(output).toContain('>x<');
        expect(output).not.toContain('data-raw=');
        expect(output.length).toBeLessThan(source.length * 30);
        expect(output.match(/class="mu-inline-rule mu-raw-html"/g)).toHaveLength(4000);
    });

    it('retains raw source metadata for anchor link tools', () => {
        const source = '<a href="/url">link</a>';
        const wrapper = document.createElement('div');
        wrapper.innerHTML = render(source);
        expect(wrapper.querySelector('a')!.dataset.raw).toBe(source);
    });

    it.each(['<script>![alt](/hidden.png)</script>', '<textarea>![alt](/hidden.png)</textarea>', '<ruby>![alt](/hidden.png)</ruby>'])('does not render Markdown children owned by literal HTML or ruby: %s', (source) => {
        const load = vi.spyOn(muya.editor.inlineEngine.renderer, 'loadImageAsync');
        render(source);
        expect(load).not.toHaveBeenCalled();
    });
});
