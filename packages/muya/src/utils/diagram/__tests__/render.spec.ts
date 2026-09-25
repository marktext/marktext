// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { finalizeRenderedDiagram, withMermaidInit } from '../render';

const hosts: HTMLElement[] = [];

afterEach(() => {
    while (hosts.length) hosts.pop()!.remove();
});

function makeTarget(html = ''): HTMLElement {
    const target = document.createElement('div');
    target.innerHTML = html;
    document.body.appendChild(target);
    hosts.push(target);
    return target;
}

const FALLBACK = 'Diagram';

describe('finalizeRenderedDiagram — viewBox', () => {
    it('derives a viewBox from the pixel width/height of an svg that has none', () => {
        const target = makeTarget('<svg width="640" height="480"></svg>');

        finalizeRenderedDiagram(target, FALLBACK);

        expect(target.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 640 480');
    });

    it('leaves an existing viewBox untouched', () => {
        const target = makeTarget('<svg viewBox="0 0 10 20" width="640" height="480"></svg>');

        finalizeRenderedDiagram(target, FALLBACK);

        expect(target.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 10 20');
    });

    it('applies once an svg that mounts before its dimensions gets sized', async () => {
        const target = makeTarget();

        finalizeRenderedDiagram(target, FALLBACK);

        target.innerHTML = '<svg></svg>';
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(target.querySelector('svg')!.getAttribute('viewBox')).toBeNull();
        expect(target.getAttribute('role')).toBeNull();

        const svg = target.querySelector('svg')!;
        svg.setAttribute('width', '300');
        svg.setAttribute('height', '150');
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(svg.getAttribute('viewBox')).toBe('0 0 300 150');
        expect(target.getAttribute('role')).toBe('img');
    });
});

describe('finalizeRenderedDiagram — accessible name', () => {
    it('marks the target as an image', () => {
        const target = makeTarget('<svg viewBox="0 0 1 1"></svg>');

        finalizeRenderedDiagram(target, FALLBACK);

        expect(target.getAttribute('role')).toBe('img');
    });

    it('names the diagram from its <title>', () => {
        const target = makeTarget('<svg viewBox="0 0 1 1"><title>Order flow</title></svg>');

        finalizeRenderedDiagram(target, FALLBACK);

        expect(target.getAttribute('aria-label')).toBe('Order flow');
    });

    it('names the diagram from its <desc>', () => {
        const target = makeTarget('<svg viewBox="0 0 1 1"><desc>Three services talking</desc></svg>');

        finalizeRenderedDiagram(target, FALLBACK);

        expect(target.getAttribute('aria-label')).toBe('Three services talking');
    });

    it('joins a title and a description', () => {
        const target = makeTarget(
            '<svg viewBox="0 0 1 1"><title>Order flow</title><desc>Three services talking</desc></svg>',
        );

        finalizeRenderedDiagram(target, FALLBACK);

        expect(target.getAttribute('aria-label')).toBe('Order flow. Three services talking');
    });

    it('prefers an aria-label the renderer already put on the svg', () => {
        const target = makeTarget(
            '<svg viewBox="0 0 1 1" aria-label="Explicit"><title>Order flow</title></svg>',
        );

        finalizeRenderedDiagram(target, FALLBACK);

        expect(target.getAttribute('aria-label')).toBe('Explicit');
    });

    it('ignores the boilerplate <desc> Raphael stamps on flowchart.js output', () => {
        const target = makeTarget(
            '<svg viewBox="0 0 1 1"><desc>Created with Raphaël 2.1.0</desc></svg>',
        );

        finalizeRenderedDiagram(target, FALLBACK);

        expect(target.getAttribute('aria-label')).toBe(FALLBACK);
    });

    it('falls back when the svg carries no accessible text', () => {
        const target = makeTarget('<svg viewBox="0 0 1 1"><g></g></svg>');

        finalizeRenderedDiagram(target, FALLBACK);

        expect(target.getAttribute('aria-label')).toBe(FALLBACK);
    });

    it('names a server-rendered PlantUML image', () => {
        const target = makeTarget('<img src="https://www.plantuml.com/plantuml/svg/abc">');

        finalizeRenderedDiagram(target, FALLBACK);

        expect(target.getAttribute('role')).toBe('img');
        expect(target.getAttribute('aria-label')).toBe(FALLBACK);
    });

    it('ignores a nested title that belongs to a shape rather than the diagram', () => {
        const target = makeTarget(
            '<svg viewBox="0 0 1 1"><g><title>Node A</title></g></svg>',
        );

        finalizeRenderedDiagram(target, FALLBACK);

        expect(target.getAttribute('aria-label')).toBe(FALLBACK);
    });
});

describe('withMermaidInit', () => {
    it('puts the directive in front of plain diagram code', () => {
        expect(withMermaidInit('graph TD\n  A-->B', { htmlLabels: false }))
            .toBe('%%{init: {"htmlLabels":false}}%%\ngraph TD\n  A-->B');
    });

    it('puts the directive after a YAML frontmatter block', () => {
        const code = '---\nconfig:\n  theme: forest\n---\ngraph TD\n  A-->B';

        expect(withMermaidInit(code, { htmlLabels: false })).toBe(
            '---\nconfig:\n  theme: forest\n---\n%%{init: {"htmlLabels":false}}%%\ngraph TD\n  A-->B',
        );
    });

    it('survives CRLF frontmatter', () => {
        const code = '---\r\nconfig:\r\n---\r\ngraph TD';

        expect(withMermaidInit(code, { htmlLabels: false }))
            .toBe('---\r\nconfig:\r\n---\r\n%%{init: {"htmlLabels":false}}%%\ngraph TD');
    });

    it('is idempotent', () => {
        const once = withMermaidInit('graph TD', { htmlLabels: false });

        expect(withMermaidInit(once, { htmlLabels: false })).toBe(once);
    });

    it('leaves a `---` that is not frontmatter alone', () => {
        expect(withMermaidInit('graph TD\n---\n', { htmlLabels: false }))
            .toBe('%%{init: {"htmlLabels":false}}%%\ngraph TD\n---\n');
    });
});
