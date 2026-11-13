import { expect, test } from '../fixtures/muya';

const diagrams = [
    'sequenceDiagram\nparticipant A as Onboarding\nparticipant B as Profile\nA->>B: Register',
    'sequenceDiagram\nparticipant C as Generator\nparticipant D as Worker\nC->>D: Generate',
    'stateDiagram-v2\n[*] --> Queued\nQueued --> Finished',
];
const markdown = diagrams.map(code => `\`\`\`mermaid\n${code}\n\`\`\``).join('\n\n');

test('multiple Mermaid diagrams and HTML export keep separate contents and SVG IDs', async ({ page }) => {
    await page.evaluate((content) => { window.muya!.setContent(content); }, markdown);
    const previews = page.locator('.mu-diagram-preview');
    await expect(previews).toHaveCount(3);
    for (const preview of await previews.all()) {
        await expect(preview.locator('svg')).toHaveCount(1, { timeout: 20_000 });
    }
    await expect(previews.nth(0)).toContainText('Register');
    await expect(previews.nth(0)).not.toContainText('Generate');
    await expect(previews.nth(1)).toContainText('Generate');
    await expect(previews.nth(1)).not.toContainText('Register');
    await expect(previews.nth(2)).toContainText('Finished');
    const ids = await previews.locator('svg').evaluateAll(nodes => nodes.map(n => n.id));
    expect(new Set(ids).size).toBe(3);

    const html = await page.evaluate(async () => {
        const html = await new window.MarkdownToHtml!(window.muya!.getMarkdown()).renderHtml();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return [...doc.querySelectorAll('div.mermaid')].map(node => ({
            text: node.textContent, svgCount: node.querySelectorAll('svg').length,
        }));
    });
    expect(html).toHaveLength(3);
    expect(html.map(node => node.svgCount)).toEqual([1, 1, 1]);
    expect(html[0].text).toContain('Register');
    expect(html[0].text).not.toContain('Generate');
    expect(html[1].text).toContain('Generate');
    expect(html[1].text).not.toContain('Register');
    expect(html[2].text).toContain('Finished');
});

test('concurrent dark previews and HTML export retain their own themes for every diagram', async ({ page }) => {
    const content = Array.from({ length: 3 }, (_, index) =>
        `\`\`\`mermaid\nflowchart TD\n A${index}[Preview ${index}] --> B${index}[Result ${index}]\n\`\`\``).join('\n\n');
    const html = await page.evaluate(async (markdown) => {
        window.__e2e!.rebuildMuya({ mermaidTheme: 'dark' });
        window.muya!.setContent(markdown);
        return new window.MarkdownToHtml!(markdown, window.muya!).renderHtml();
    }, content);

    await expect.poll(() => page.evaluate(() =>
        [...document.querySelectorAll('.mu-diagram-preview[role="img"]')].map(preview =>
            getComputedStyle(preview.querySelector('.node rect')!).fill)),
    ).toEqual(Array.from({ length: 3 }, () => 'rgb(31, 32, 32)'));

    const exported = await page.evaluate((html) => {
        const host = document.createElement('div');
        host.style.cssText = 'position:fixed;left:-99999px;top:0';
        host.innerHTML = html;
        document.body.append(host);
        try {
            return [...host.querySelectorAll('div.mermaid')].map(node => ({
                fill: getComputedStyle(node.querySelector('.node rect')!).fill,
                labels: [...node.querySelectorAll('.nodeLabel')].map(label => label.textContent),
            }));
        }
        finally {
            host.remove();
        }
    }, html);

    expect(exported.map(node => node.fill)).toEqual(Array.from({ length: 3 }, () => 'rgb(236, 236, 255)'));
    expect(exported.map(node => node.labels)).toEqual(
        Array.from({ length: 3 }, (_, index) => [`Preview ${index}`, `Result ${index}`]),
    );
});

test('HTML export preserves frontmatter, indented code and HTML labels around an invalid diagram', async ({ page }) => {
    const forest = '---\r\nconfig:\r\n  theme: forest\r\n---\r\n  flowchart TD\r\n    A["First & second<br/>next"] --> B[Done]';
    const content = [forest, 'graph TD\n A--->', 'flowchart TD\n C[Later] --> D[Valid]']
        .map(code => `\`\`\`mermaid\n${code}\n\`\`\``).join('\n\n');

    const result = await page.evaluate(async ({ code, markdown }) => {
        const reference = document.createElement('div');
        const exported = document.createElement('div');
        document.body.append(reference, exported);
        try {
            await window.__e2e!.renderDiagramForExport({
                type: 'mermaid',
                target: reference,
                code,
                htmlLabels: true,
                mermaidTheme: 'default',
                vegaTheme: 'default',
                sequenceTheme: 'simple',
                plantumlServer: '',
            });
            exported.innerHTML = await new window.MarkdownToHtml!(markdown).renderHtml();
            const nodes = [...exported.querySelectorAll('div.mermaid')];
            return {
                referenceFill: getComputedStyle(reference.querySelector('.node rect')!).fill,
                exportedFill: getComputedStyle(nodes[0].querySelector('.node rect')!).fill,
                labels: [...nodes[0].querySelectorAll('.nodeLabel')].map(label => label.textContent),
                lineBreaks: nodes[0].querySelectorAll('br').length,
                svgCounts: nodes.map(node => node.querySelectorAll('svg').length),
                invalidText: nodes[1].textContent,
                laterLabels: [...nodes[2].querySelectorAll('.nodeLabel')].map(label => label.textContent),
            };
        }
        finally {
            reference.remove();
            exported.remove();
        }
    }, { code: forest, markdown: content });

    expect(result.exportedFill).toBe(result.referenceFill);
    expect(result.exportedFill).not.toBe('rgb(236, 236, 255)');
    expect(result.labels).toEqual(['First & secondnext', 'Done']);
    expect(result.lineBreaks).toBeGreaterThan(0);
    expect(result.svgCounts).toEqual([1, 0, 1]);
    expect(result.invalidText).toBe('< Invalid Diagram >');
    expect(result.laterLabels).toEqual(['Later', 'Valid']);
});
