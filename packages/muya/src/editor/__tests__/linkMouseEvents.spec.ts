// @vitest-environment happy-dom

import type { Muya } from '../../muya';
import { afterEach, describe, expect, it } from 'vitest';
import EventCenter from '../../event';
import { attachLinkMouseHandlers } from '../linkMouseEvents';

// Regression tests for marktext commit cb25b3d4 (#1415).
// The renderer side of the port already emits dataset.{start,end,raw}
// + the right wrapper classes for all three link variants (markdown
// `[]()`, reference link, html_tag `<a>`). PR-11b builds the missing
// emitter — mouseover/mouseout on the rendered wrapper dispatches
// `muya-link-tools` so the staged LinkTools popover (PR-9-tidy) finally
// lights up.

function makeMuya() {
    const eventCenter = new EventCenter();
    const domNode = document.createElement('div');
    document.body.appendChild(domNode);
    return {
        eventCenter,
        domNode,
        muya: { eventCenter, domNode } as unknown as Muya,
    };
}

afterEach(() => {
    // Each session gets a fresh EventCenter + domNode, so isolation comes
    // from wiping the DOM here — detached nodes' listeners are GC'd along
    // with them.
    document.body.innerHTML = '';
});

interface ILinkToolsPayload {
    reference: HTMLElement;
    linkInfo?: { href?: string; raw?: string };
    type: 'preview' | 'edit';
}

function captureEmits(eventCenter: EventCenter): ILinkToolsPayload[] {
    const emits: ILinkToolsPayload[] = [];
    eventCenter.subscribe('muya-link-tools', (payload: ILinkToolsPayload) => emits.push(payload));
    return emits;
}

function mouseover(el: HTMLElement) {
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
}

describe('linkMouseEvents — dispatches muya-link-tools on hover', () => {
    it('emits on mouseover of a markdown link `<span class="mu-link">` in preview mode', () => {
        const { muya, eventCenter, domNode } = makeMuya();
        const emits = captureEmits(eventCenter);
        attachLinkMouseHandlers(muya);

        // Preview-mode link: the leading `[` marker is `.mu-hide`, so the
        // wrapper is the rendered popover target.
        const marker = document.createElement('span');
        marker.classList.add('mu-hide');
        const link = document.createElement('span');
        link.classList.add('mu-inline-rule', 'mu-link');
        link.dataset.raw = '[hi](https://x.com)';
        link.dataset.start = '0';
        link.dataset.end = '19';
        (link as HTMLElement & { href: string }).href = 'https://x.com';
        link.textContent = 'hi';
        domNode.appendChild(marker);
        domNode.appendChild(link);

        mouseover(link);
        expect(emits).toHaveLength(1);
        expect(emits[0].reference).toBe(link);
        expect(emits[0].linkInfo?.href).toBe('https://x.com');
    });

    it('emits on mouseover of a reference link `<a class="mu-reference-link">`', () => {
        const { muya, eventCenter, domNode } = makeMuya();
        const emits = captureEmits(eventCenter);
        attachLinkMouseHandlers(muya);

        // Preview-mode wrapper as before — refLink also has a leading marker.
        const marker = document.createElement('span');
        marker.classList.add('mu-hide');
        const link = document.createElement('a');
        link.classList.add('mu-inline-rule', 'mu-reference-link');
        link.setAttribute('href', 'https://example.com');
        link.dataset.raw = '[foo][bar]';
        link.dataset.start = '0';
        link.dataset.end = '10';
        link.textContent = 'foo';
        domNode.appendChild(marker);
        domNode.appendChild(link);

        mouseover(link);
        expect(emits).toHaveLength(1);
        expect(emits[0].linkInfo?.href).toBe('https://example.com');
    });

    it('emits on mouseover of an html_tag `<a class="mu-raw-html">` (no marker required)', () => {
        const { muya, eventCenter, domNode } = makeMuya();
        const emits = captureEmits(eventCenter);
        attachLinkMouseHandlers(muya);

        // html_tag <a> doesn't have a "hidden source marker" sibling —
        // the inline rendering already IS the rendered form.
        const link = document.createElement('a');
        link.classList.add('mu-inline-rule', 'mu-raw-html');
        link.setAttribute('href', 'https://x.com');
        link.dataset.raw = '<a href="https://x.com">x</a>';
        link.dataset.start = '5';
        link.dataset.end = '34';
        link.textContent = 'x';
        domNode.appendChild(link);

        mouseover(link);
        expect(emits).toHaveLength(1);
        expect(emits[0].linkInfo?.href).toBe('https://x.com');
    });

    it('emits with reference: null on mouseout of a link', () => {
        const { muya, eventCenter, domNode } = makeMuya();
        const emits = captureEmits(eventCenter);
        attachLinkMouseHandlers(muya);

        const link = document.createElement('a');
        link.classList.add('mu-inline-rule', 'mu-raw-html');
        link.setAttribute('href', 'https://x.com');
        link.dataset.raw = '<a href="https://x.com">x</a>';
        domNode.appendChild(link);

        mouseover(link);
        emits.length = 0;
        link.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
        expect(emits).toHaveLength(1);
        expect(emits[0].reference).toBeNull();
    });

    it('does NOT emit on mouseover of a non-link element', () => {
        const { muya, eventCenter, domNode } = makeMuya();
        const emits = captureEmits(eventCenter);
        attachLinkMouseHandlers(muya);

        const para = document.createElement('p');
        para.textContent = 'plain text';
        domNode.appendChild(para);

        mouseover(para);
        expect(emits).toHaveLength(0);
    });

    it('does NOT emit when the markdown link is in EDIT mode (no hidden marker sibling)', () => {
        const { muya, eventCenter, domNode } = makeMuya();
        const emits = captureEmits(eventCenter);
        attachLinkMouseHandlers(muya);

        // Edit-mode link: previous sibling is mu-gray (visible), not mu-hide.
        const marker = document.createElement('span');
        marker.classList.add('mu-gray');
        const link = document.createElement('span');
        link.classList.add('mu-inline-rule', 'mu-link');
        link.dataset.raw = '[hi](https://x.com)';
        domNode.appendChild(marker);
        domNode.appendChild(link);

        mouseover(link);
        expect(emits).toHaveLength(0);
    });

    it('detaches all handlers when eventCenter.detachAllDomEvents runs (no leakage)', () => {
        const { muya, eventCenter, domNode } = makeMuya();
        const emits = captureEmits(eventCenter);
        attachLinkMouseHandlers(muya);

        const link = document.createElement('a');
        link.classList.add('mu-inline-rule', 'mu-raw-html');
        link.setAttribute('href', 'https://x.com');
        link.dataset.raw = '<a href="https://x.com">x</a>';
        domNode.appendChild(link);

        eventCenter.detachAllDomEvents();
        mouseover(link);
        expect(emits).toHaveLength(0);
    });

    // Copilot review #1 on PR #226: `mouseout` fires when the pointer
    // crosses between descendants of the same link wrapper (e.g. text →
    // <strong> → text). The handler guards via `relatedTarget` — if the
    // pointer is moving to a node still inside the same wrapper, skip
    // the hide emit so the popover doesn't blink.
    it('does NOT emit reference:null when the pointer moves between descendants of the same wrapper', () => {
        const { muya, eventCenter, domNode } = makeMuya();
        const emits = captureEmits(eventCenter);
        attachLinkMouseHandlers(muya);

        const link = document.createElement('span');
        link.classList.add('mu-inline-rule', 'mu-link');
        link.dataset.raw = '[hi](https://x.com)';
        (link as HTMLElement & { href: string }).href = 'https://x.com';
        // Inner spans like emphasis/strong that text children get wrapped in.
        const innerA = document.createElement('em');
        innerA.textContent = 'hi-em';
        const innerB = document.createElement('strong');
        innerB.textContent = 'hi-strong';
        link.appendChild(innerA);
        link.appendChild(innerB);
        const marker = document.createElement('span');
        marker.classList.add('mu-hide');
        domNode.appendChild(marker);
        domNode.appendChild(link);

        mouseover(link);
        emits.length = 0;

        // Pointer moves from `innerA` to `innerB` — both still inside `link`.
        const ev = new MouseEvent('mouseout', { bubbles: true, relatedTarget: innerB });
        innerA.dispatchEvent(ev);

        expect(emits).toHaveLength(0);
    });

    // PR-11b removed the `pointer-events: none` rule that previously
    // suppressed native navigation. The compensating click handler must
    // `preventDefault()` on link clicks so the user isn't navigated away
    // when they click a link inside the editor.
    it.each([
        ['a.mu-no-text-link', 'a', ['mu-no-text-link', 'mu-inline-rule']],
        ['a.mu-reference-link', 'a', ['mu-inline-rule', 'mu-reference-link']],
        ['a.mu-raw-html', 'a', ['mu-inline-rule', 'mu-raw-html']],
    ])('prevents default on click of %s wrappers', (_label, tagName, classes) => {
        const { muya, domNode } = makeMuya();
        attachLinkMouseHandlers(muya);

        const link = document.createElement(tagName);
        for (const c of classes)
            link.classList.add(c);
        link.setAttribute('href', 'https://x.com');
        domNode.appendChild(link);

        const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
        link.dispatchEvent(ev);
        expect(ev.defaultPrevented).toBe(true);
    });

    it('does NOT prevent default on click of non-link elements', () => {
        const { muya, domNode } = makeMuya();
        attachLinkMouseHandlers(muya);

        const p = document.createElement('p');
        p.textContent = 'plain';
        domNode.appendChild(p);

        const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
        p.dispatchEvent(ev);
        expect(ev.defaultPrevented).toBe(false);
    });

    it('does NOT prevent default on click of `span.mu-link` (span has no native navigation)', () => {
        const { muya, domNode } = makeMuya();
        attachLinkMouseHandlers(muya);

        const span = document.createElement('span');
        span.classList.add('mu-inline-rule', 'mu-link');
        domNode.appendChild(span);

        const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
        span.dispatchEvent(ev);
        // Span doesn't trigger native navigation, so no preventDefault needed.
        expect(ev.defaultPrevented).toBe(false);
    });

    // Copilot review #2 on PR #226: getLinkInfo can return null (e.g. the
    // wrapper has the right class but no data-raw). Don't emit a reference
    // with a null linkInfo — the subscriber may not handle it gracefully.
    // Regression for the bug discovered during manual UX testing of PR #226:
    // `htmlTag.ts` adds `.mu-raw-html` to *every* inline HTML tag (`<u>`,
    // `<mark>`, `<sub>`, `<sup>`, `<a>`), not just `<a>`. The original
    // selector `.mu-raw-html` was too loose and lit up the link popover on
    // hover over `<u>underline</u>` / `<mark>highlight</mark>`. Narrow the
    // selector to `a.mu-raw-html` so only actual anchor tags fire.
    // Defensive: an unresolved reference link is rendered as
    // `<span class="mu-reference-link">` (no href), and intentionally NOT
    // picked up by the popover — the user can't usefully jump or unlink
    // something that has no resolved definition.
    it('does NOT emit on mouseover of an unresolved <span class="mu-reference-link"> (no href, no anchor tag)', () => {
        const { muya, eventCenter, domNode } = makeMuya();
        const emits = captureEmits(eventCenter);
        attachLinkMouseHandlers(muya);

        const marker = document.createElement('span');
        marker.classList.add('mu-hide');
        const span = document.createElement('span');
        span.classList.add('mu-reference-link');
        span.dataset.raw = '[foo][missing]';
        span.textContent = 'foo';
        domNode.appendChild(marker);
        domNode.appendChild(span);

        mouseover(span);
        expect(emits).toHaveLength(0);
    });

    it.each([
        ['underline', 'u'],
        ['mark', 'mark'],
        ['subscript', 'sub'],
        ['superscript', 'sup'],
    ])('does NOT emit on mouseover of non-anchor inline HTML <%s class="mu-raw-html">', (_label, tagName) => {
        const { muya, eventCenter, domNode } = makeMuya();
        const emits = captureEmits(eventCenter);
        attachLinkMouseHandlers(muya);

        const el = document.createElement(tagName);
        el.classList.add('mu-inline-rule', 'mu-raw-html');
        el.dataset.raw = `<${tagName}>x</${tagName}>`;
        el.textContent = 'x';
        domNode.appendChild(el);

        mouseover(el);
        expect(emits).toHaveLength(0);
    });

    it('does NOT emit when the link wrapper has no data-raw (getLinkInfo returns null)', () => {
        const { muya, eventCenter, domNode } = makeMuya();
        const emits = captureEmits(eventCenter);
        attachLinkMouseHandlers(muya);

        // html_tag wrapper but missing data-raw — unlikely in production but
        // a defensive guard so the popover doesn't show a half-empty payload.
        const link = document.createElement('a');
        link.classList.add('mu-inline-rule', 'mu-raw-html');
        link.setAttribute('href', 'https://x.com');
        // No dataset.raw assigned.
        domNode.appendChild(link);

        mouseover(link);
        expect(emits).toHaveLength(0);
    });
});
