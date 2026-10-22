import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';

const FLOWCHART = 'flowchart TD\n    A["Ada Lovelace"] --> B["Charles Babbage"]';

interface RenderProbe {
    foreignObjects: number;
    labels: string[];
}

async function renderForExport(page: Page, htmlLabels: boolean): Promise<RenderProbe> {
    return page.evaluate(
        async ({ code, htmlLabels }) => {
            const host = document.createElement('div');
            host.style.cssText = 'position:fixed;left:-99999px;top:0';
            document.body.appendChild(host);
            try {
                await window.__e2e!.renderDiagramForExport({
                    type: 'mermaid',
                    code,
                    target: host,
                    htmlLabels,
                    mermaidTheme: 'default',
                    vegaTheme: 'latimes',
                    plantumlServer: 'https://www.plantuml.com/plantuml',
                    sequenceTheme: 'hand',
                });

                return {
                    foreignObjects: host.querySelectorAll('foreignObject').length,
                    labels: [...host.querySelectorAll('text, tspan')]
                        .map(node => node.textContent?.trim() ?? '')
                        .filter(Boolean),
                };
            }
            finally {
                host.remove();
            }
        },
        { code: FLOWCHART, htmlLabels },
    );
}

test.describe('mermaid export render', () => {
    test('mermaid draws flowchart labels in a foreignObject by default', async ({ page }) => {
        const probe = await renderForExport(page, true);

        expect(probe.foreignObjects).toBeGreaterThan(0);
    });

    test('htmlLabels:false draws the same labels as real <text>', async ({ page }) => {
        const probe = await renderForExport(page, false);

        expect(probe.foreignObjects).toBe(0);
        expect(probe.labels.join(' ')).toContain('Ada Lovelace');
        expect(probe.labels.join(' ')).toContain('Charles Babbage');
    });
});
