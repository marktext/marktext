// Integration specs must select the happy-dom environment in their own file.

import { afterEach, beforeEach } from 'vitest';
import { Muya } from '../muya';

const bootedMuyas: Muya[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

/**
 * Register the per-test MUYA_VERSION stub and automatic teardown of any Muya
 * booted via `bootMuya`. Call once at the top of a `describe` file.
 */
export function useMuyaHarness(): void {
    beforeEach(() => {
        hadVersion = 'MUYA_VERSION' in window;
        originalVersion = window.MUYA_VERSION;
        window.MUYA_VERSION = 'test';
    });

    afterEach(() => {
        while (bootedMuyas.length)
            bootedMuyas.pop()!.destroy();
        if (hadVersion)
            window.MUYA_VERSION = originalVersion as string;
        else
            delete (window as Partial<Window>).MUYA_VERSION;
    });
}

/** Boot a Muya editor on a fresh host from the given markdown. Auto-torn-down. */
export function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedMuyas.push(muya);
    return muya;
}
