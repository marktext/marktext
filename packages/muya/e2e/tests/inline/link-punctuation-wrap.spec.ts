import { expect, test } from '../fixtures/muya';

// #2258 / #3025 — punctuation right after a link wraps to its own line. With the
// caret outside a link its `](url)` markers render as zero-size `.mu-hide
// .mu-remove` spans. As `inline-block` (atomic) boxes they introduce soft-wrap
// opportunities between the link and the following text, so a trailing period
// can break onto its own line. This drives the REAL stylesheet rule: a hidden
// marker sandwiched between a word and a period, in a container just wide enough
// for the word, must not push the period to a new line.

test.describe('punctuation after a link does not wrap (#2258/#3025)', () => {
    test('a zero-size hidden marker introduces no wrap opportunity before a period', async ({ page }) => {
        await page.goto('http://localhost:5174/');

        const sameLine = await page.evaluate(() => {
            const host = document.createElement('div');
            host.style.cssText = 'position:absolute;top:0;left:0;font-size:16px;line-height:1.5;white-space:normal;';
            host.innerHTML
                = '<span id="w">aaaa</span>'
                + '<span class="mu-hide mu-remove">](http://example.com)</span>'
                + '<span id="d">.</span>';
            document.body.appendChild(host);

            const w = document.getElementById('w')!;
            // Just wide enough for the word — the period is the only overflow
            // candidate, so it wraps iff a break opportunity exists before it.
            host.style.width = `${Math.ceil(w.getBoundingClientRect().width) + 2}px`;

            const wTop = Math.round(w.getBoundingClientRect().top);
            const dTop = Math.round(document.getElementById('d')!.getBoundingClientRect().top);
            host.remove();
            return dTop <= wTop;
        });

        expect(sameLine).toBe(true);
    });
});
