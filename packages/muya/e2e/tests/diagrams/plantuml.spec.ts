import type { TState } from '@muyajs/core';
import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

/**
 * PlantUML diagram rendering. The PlantUML loader (packages/core/src/utils/
 * diagram/plantuml/index.ts) hands off to the public `www.plantuml.com/plantuml`
 * service: it base64-encodes the source and sets `<img src="…/svg/<encoded>">`.
 *
 * We never want the real network in a unit-ish e2e: it'd be flaky and would
 * leak telemetry. Intercept all plantuml.com traffic and return a small inline
 * SVG so the spec asserts the integration (encoded URL + img mount) without
 * relying on the external service.
 */

const PLANTUML_SOURCE = '@startuml\nA -> B\n@enduml';

const STUB_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">'
    + '<rect width="40" height="40" fill="#abc"/></svg>';

test.describe('plantuml diagram', () => {
    test.beforeEach(async ({ page }) => {
        // Hermetic mock: every plantuml.com request returns the same stub SVG.
        await page.route('**/plantuml.com/**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'image/svg+xml',
                body: STUB_SVG,
            });
        });
    });

    test('setContent with @startuml renders an <img> pointing at plantuml.com', async ({ page }) => {
        await page.evaluate((text) => {
            const state: TState[] = [{
                name: 'diagram',
                text,
                meta: { lang: 'yaml', type: 'plantuml' },
            }];
            window.muya!.setContent(state);
        }, PLANTUML_SOURCE);

        // The PlantUML renderer writes `<img src="…/svg/<encoded>">` into the
        // diagram preview synchronously after the loader resolves. Wait for
        // the `<img>` to appear.
        const img = page.locator(`${editor.diagramPreview} img`).first();
        await expect(img).toBeVisible({ timeout: 10_000 });

        const src = await img.getAttribute('src');
        expect(src).toBeTruthy();
        // The encoded URL points at the public service. We can't assert the
        // exact encoded blob (it's deflate+base64), but the prefix shape is
        // stable.
        expect(src).toMatch(/^https?:\/\/(www\.)?plantuml\.com\/plantuml\/svg\//);
    });

    test('plantuml diagram round-trips through getMarkdown', async ({ page }) => {
        await page.evaluate((text) => {
            const state: TState[] = [{
                name: 'diagram',
                text,
                meta: { lang: 'yaml', type: 'plantuml' },
            }];
            window.muya!.setContent(state);
        }, PLANTUML_SOURCE);

        await expect(page.locator(`${editor.diagramPreview} img`).first())
            .toBeVisible({ timeout: 10_000 });

        const md = await page.evaluate(() => window.muya!.getMarkdown());
        expect(md).toContain('```plantuml');
        expect(md).toContain('@startuml');
        expect(md).toContain('A -> B');
        expect(md).toContain('@enduml');
    });
});
