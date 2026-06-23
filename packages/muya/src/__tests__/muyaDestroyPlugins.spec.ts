// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../muya';

// #3315: Muya.destroy() hid visible float tools but never invoked each UI
// plugin's destroy(), so nodes appended to document.body in plugin
// constructors/init (float boxes, the image resize bar) leaked permanently.
// destroy() must iterate the registered plugins and call destroy() on each.

const bootedHosts: HTMLElement[] = [];
let hadVersion = false;
let originalVersion: string | undefined;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length) bootedHosts.pop()!.remove();
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

describe('muya.destroy — UI plugin cleanup (#3315)', () => {
    it('calls destroy() on every registered UI plugin', () => {
        const muya = bootMuya('hello\n');
        const destroyA = vi.fn();
        const destroyB = vi.fn()
    ;(muya as unknown as { _uiPlugins: Record<string, unknown> })._uiPlugins = {
            a: { destroy: destroyA },
            b: { destroy: destroyB },
        };

        muya.destroy();

        expect(destroyA).toHaveBeenCalledTimes(1);
        expect(destroyB).toHaveBeenCalledTimes(1);
    });

    it('does not throw for a plugin without a destroy() method', () => {
        const muya = bootMuya('hello\n')
    ;(muya as unknown as { _uiPlugins: Record<string, unknown> })._uiPlugins = {
            legacy: {},
        };

        expect(() => muya.destroy()).not.toThrow();
    });
});
