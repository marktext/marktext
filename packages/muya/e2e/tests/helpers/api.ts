import type { Page } from '@playwright/test';

/** Pull the current markdown out of the editor's public API. */
export async function getMarkdown(page: Page): Promise<string> {
    return page.evaluate(() => window.muya!.getMarkdown());
}

export async function getState(page: Page): Promise<unknown> {
    return page.evaluate(() => window.muya!.getState());
}

export async function getTOC(page: Page): Promise<Array<{
    lvl: number;
    content: string;
    slug: string;
    githubSlug: string;
}>> {
    return page.evaluate(() => window.muya!.getTOC() as Array<{
        lvl: number;
        content: string;
        slug: string;
        githubSlug: string;
    }>);
}

/** Read the test-only mocks the host wires onto window.__e2e. */
export async function getLinkJumps(page: Page): Promise<Array<{ href?: string }>> {
    return page.evaluate(() => window.__e2e!.linkJumps.slice());
}

export async function getInitialMarkdown(page: Page): Promise<string> {
    return page.evaluate(() => window.__e2e!.INITIAL_MARKDOWN);
}
