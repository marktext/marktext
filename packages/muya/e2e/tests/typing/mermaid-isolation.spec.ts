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
