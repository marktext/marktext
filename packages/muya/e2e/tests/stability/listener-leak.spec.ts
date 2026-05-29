import { expect, test } from '../fixtures/muya';

/**
 * Direct regression test for the EventCenter listener-leak fix in PR-17
 * (commit 39852a6). The bug: muya.destroy() detached DOM events but did
 * NOT clear the custom pub/sub `listeners` map, so blocks from the
 * destroyed instance kept their closures referenced via on()/once()
 * subscriptions — a hot rebuild loop (e.g. theme toggle, locale switch)
 * would grow listener arrays unboundedly.
 *
 * The fix added `unsubscribeAll()` to EventCenter and a call to it from
 * Muya.destroy(). This spec exercises that path 50× and asserts the
 * listener-array footprint stays bounded.
 *
 * Snapshot field shapes (see packages/core/src/event/index.ts):
 *   - `events`: Array<{ eventId, target, event, listener, capture }>
 *     — DOM listeners. Cleared by detachAllDomEvents().
 *   - `listeners`: Record<eventName, Array<{ listener, once }>>
 *     — pub/sub subscriptions. Cleared by unsubscribeAll(). This is
 *     where the original leak lived.
 *
 * Note: the BACKLOG description referred to a `Map` named `events`, but
 * the actual implementation uses an `IEvent[]` array. The leak target
 * is `listeners` (the custom pub/sub), not `events` (DOM bindings).
 * Both are asserted below.
 */
test.describe('stability / listener leak', () => {
    test('50× setContent/locale/destroy/init cycle keeps listener count bounded', async ({ page }) => {
        // First, snapshot the counts right after the host's initial boot
        // (before the loop runs). The fixture has already waited for
        // muya.init() to finish, so this is a clean baseline.
        const baseline = await page.evaluate(() => ({
            domEvents: window.muya!.eventCenter.events.length,
            listenerEventNames: Object.keys(window.muya!.eventCenter.listeners).length,
            listenerTotal: Object.values(window.muya!.eventCenter.listeners)
                .reduce((sum, arr) => sum + arr.length, 0),
        }));

        // Capture snapshot after iteration #1 (the first rebuild) so we
        // compare against a *rebuilt* baseline, not the host's initial
        // boot — the host registers UI plugins that bind extra DOM
        // listeners only on first init.
        let afterIter1: typeof baseline | null = null;

        // Loop 50× — single page.evaluate so we don't pay the
        // Playwright<->page roundtrip cost on every iteration. Three
        // throw-away locale objects suffice for the "switch locale 3
        // ways" requirement — content doesn't matter because the bug
        // we're guarding against is the *count* of listeners retained
        // across destroy, not what the locale resources do.
        const afterLoop = await page.evaluate(({ baselineDomEvents }) => {
            const stubLocales = [
                { name: 'stub-a', resource: { hello: 'A' } },
                { name: 'stub-b', resource: { hello: 'B' } },
                { name: 'stub-c', resource: { hello: 'C' } },
            ];

            const snapshots: Array<{ domEvents: number; listenerTotal: number; listenerEventNames: number }> = [];

            for (let i = 0; i < 50; i++) {
                window.muya!.setContent('foo');
                window.muya!.setContent('bar');
                window.muya!.locale(stubLocales[0]);
                window.muya!.locale(stubLocales[1]);
                window.muya!.locale(stubLocales[2]);
                window.__e2e!.rebuildMuya();

                if (i === 0 || i === 49) {
                    snapshots.push({
                        domEvents: window.muya!.eventCenter.events.length,
                        listenerEventNames: Object.keys(window.muya!.eventCenter.listeners).length,
                        listenerTotal: Object.values(window.muya!.eventCenter.listeners)
                            .reduce((sum, arr) => sum + arr.length, 0),
                    });
                }
            }

            return { iter1: snapshots[0], iter50: snapshots[1], baselineDomEvents };
        }, { baselineDomEvents: baseline.domEvents });

        afterIter1 = afterLoop.iter1;
        const afterIter50 = afterLoop.iter50;

        // Sanity: both snapshots actually captured something.
        expect(afterIter1).not.toBeNull();
        expect(afterIter50).not.toBeNull();

        // Core regression assertion: the listener-total must not grow
        // unboundedly across 49 rebuild cycles. ±5 is the leak budget
        // from the task spec — generous enough to absorb stable per-instance
        // setup differences but tight enough to catch a true leak (the
        // original bug would have grown by ~hundreds over 50 iterations).
        const delta = Math.abs(afterIter50.listenerTotal - afterIter1.listenerTotal);
        expect(delta, `listener total grew by ${delta} over 49 rebuilds (iter1=${afterIter1.listenerTotal}, iter50=${afterIter50.listenerTotal})`).toBeLessThanOrEqual(5);

        // DOM events array also shouldn't grow unboundedly. After each
        // destroy() detachAllDomEvents resets it to []; the new instance
        // re-binds focus/blur and the floats re-attach their handlers.
        // A fresh instance has a fixed-size set of DOM bindings.
        const domDelta = Math.abs(afterIter50.domEvents - afterIter1.domEvents);
        expect(domDelta, `domEvents grew by ${domDelta} (iter1=${afterIter1.domEvents}, iter50=${afterIter50.domEvents})`).toBeLessThanOrEqual(5);

        // Tail of distinct event names (Object.keys of listeners) must not
        // grow either — each new instance subscribes to the same set.
        const namesDelta = Math.abs(afterIter50.listenerEventNames - afterIter1.listenerEventNames);
        expect(namesDelta).toBeLessThanOrEqual(2);
    });
});
