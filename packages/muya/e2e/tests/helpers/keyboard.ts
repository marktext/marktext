import type { Page } from '@playwright/test';
import process from 'node:process';
import { editor } from './selectors';

/** Cmd on macOS Playwright runs; Control elsewhere. */
export function metaKey(): 'Meta' | 'Control' {
    return process.platform === 'darwin' ? 'Meta' : 'Control';
}

/** Click into the editor root so subsequent keyboard events land in muya. */
export async function focusEditor(page: Page): Promise<void> {
    await page.locator(editor.container).click();
}

/**
 * Select all editor content via Cmd/Ctrl+A.
 * (The host's #select-all button works too; this avoids a button click for
 * tests that don't want to assert on button wiring.)
 */
export async function selectAll(page: Page): Promise<void> {
    await page.keyboard.press(`${metaKey()}+a`);
}

/** Replace all editor content with a fresh markdown string. */
export async function loadMarkdown(page: Page, markdown: string): Promise<void> {
    await page.evaluate((md) => {
        window.muya!.setContent(md);
    }, markdown);
}

/**
 * Type text into the focused editor with a small per-character delay.
 *
 * muya's content-change pipeline re-renders synchronously per keystroke; with
 * Playwright's default 0ms delay the next event can arrive before snabbdom
 * has patched the DOM, leading to dropped characters. 30ms is empirically
 * the sweet spot — small enough that 11-char strings finish under 500 ms,
 * large enough to ride out the patch cycle.
 */
export async function slowType(page: Page, text: string, delayMs = 30): Promise<void> {
    await page.keyboard.type(text, { delay: delayMs });
}
