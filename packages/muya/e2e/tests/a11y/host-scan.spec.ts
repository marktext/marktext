import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '../fixtures/muya';
import { slowType } from '../helpers/keyboard';
import { editor, floats } from '../helpers/selectors';

// `axe-core` is a transitive dep of `@axe-core/playwright`. We don't list it
// as a direct dependency so we lift `Result` off the return type of
// AxeBuilder().analyze() rather than importing `axe-core` directly.
type IAxeViolation = Awaited<ReturnType<InstanceType<typeof AxeBuilder>['analyze']>>['violations'][number];

/**
 * Accessibility smoke. Phase 4 starts with the lowest tier — `critical`
 * only — and tightens over time as we fix issues. Non-critical
 * violations are surfaced via `console.log` in CI logs so Phase 5 can
 * triage them.
 *
 * axe-core categorizes violations by `impact`: 'minor' | 'moderate' |
 * 'serious' | 'critical'. We currently assert only on `critical` so
 * Phase 4 lands green; Phase 5 should tighten to `serious+` once the
 * known offenders (likely contrast/aria from third-party CSS) are
 * filed as follow-ups.
 *
 * Scope: every scan EXCLUDES `.tools`, the host test-harness toolbar
 * (it's just bare <select>/<button> markup with no labels — fixing it
 * isn't on the muya editor's critical path). Excluding it keeps the
 * focus on the editor + its mounted float plugins, which is the
 * actually-shipped a11y surface. The host-toolbar violations are
 * captured as Phase 5 follow-up in BACKLOG.
 */

const EXCLUDE_HOST_TOOLBAR = ['.tools'] as const;

function criticalViolations(violations: ReadonlyArray<IAxeViolation>): IAxeViolation[] {
    return violations.filter(v => v.impact === 'critical');
}

function logNonCritical(scope: string, violations: ReadonlyArray<IAxeViolation>): void {
    if (violations.length > 0) {
        // eslint-disable-next-line no-console -- CI log breadcrumb for Phase 5 triage
        console.log(`[a11y/${scope}] non-critical violations:`, violations.map(v => `${v.id} (${v.impact})`).join(', '));
    }
}

test.describe('a11y / host page scan', () => {
    test('clean host page has no critical violations after init', async ({ page }) => {
        const results = await new AxeBuilder({ page })
            .exclude([...EXCLUDE_HOST_TOOLBAR])
            .analyze();
        const critical = criticalViolations(results.violations);
        logNonCritical('clean', results.violations);
        expect(critical, critical.length ? `critical: ${critical.map(v => v.id).join(', ')}` : '').toEqual([]);
    });

    test('inline format toolbar visible: no critical violations', async ({ page }) => {
        // Select text in the host's initial markdown to surface the IFT.
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.press('Home');
        await page.keyboard.down('Shift');
        await page.keyboard.press('End');
        await page.keyboard.up('Shift');
        await expect(page.locator(floats.inlineFormatToolbar)).toBeVisible();

        const results = await new AxeBuilder({ page }).exclude([...EXCLUDE_HOST_TOOLBAR]).analyze();
        const critical = criticalViolations(results.violations);
        logNonCritical('ift', results.violations);
        expect(critical, critical.length ? `critical: ${critical.map(v => v.id).join(', ')}` : '').toEqual([]);
    });

    test('slash menu open: no critical violations', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.type('/');
        await expect(page.locator(floats.quickInsert)).toBeVisible();

        const results = await new AxeBuilder({ page }).exclude([...EXCLUDE_HOST_TOOLBAR]).analyze();
        const critical = criticalViolations(results.violations);
        logNonCritical('slash', results.violations);
        expect(critical, critical.length ? `critical: ${critical.map(v => v.id).join(', ')}` : '').toEqual([]);
    });

    test('link tools floating popup: no critical violations', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.setContent('A [link](https://example.com) here.');
        });
        await page.locator(editor.paragraph).first().click({ position: { x: 2, y: 2 } });
        await page.locator('span.mu-link').first().hover();
        await expect(page.locator(floats.linkTools)).toBeVisible();

        const results = await new AxeBuilder({ page }).exclude([...EXCLUDE_HOST_TOOLBAR]).analyze();
        const critical = criticalViolations(results.violations);
        logNonCritical('link-tools', results.violations);
        expect(critical, critical.length ? `critical: ${critical.map(v => v.id).join(', ')}` : '').toEqual([]);
    });

    test('image toolbar visible after clicking an image: no critical violations', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.setContent('![alt](https://example.test/host-img.png "t")');
        });
        const image = page.locator(editor.image).first();
        await expect(image).toBeVisible();
        await image.click();

        const results = await new AxeBuilder({ page }).exclude([...EXCLUDE_HOST_TOOLBAR]).analyze();
        const critical = criticalViolations(results.violations);
        logNonCritical('image-tools', results.violations);
        expect(critical, critical.length ? `critical: ${critical.map(v => v.id).join(', ')}` : '').toEqual([]);
    });

    test('table tools visible after clicking into a table cell: no critical violations', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.setContent('| h1 | h2 |\n| --- | --- |\n| a | b |');
        });
        const table = page.locator(editor.table).first();
        await expect(table).toBeVisible();
        // Click into a body cell — both TableDragBar and TableColumnToolbar
        // mount their floats but only become visible on cell focus / hover.
        await table.locator('td').first().click();
        await slowType(page, 'x');

        const results = await new AxeBuilder({ page }).exclude([...EXCLUDE_HOST_TOOLBAR]).analyze();
        const critical = criticalViolations(results.violations);
        logNonCritical('table-tools', results.violations);
        expect(critical, critical.length ? `critical: ${critical.map(v => v.id).join(', ')}` : '').toEqual([]);
    });
});
