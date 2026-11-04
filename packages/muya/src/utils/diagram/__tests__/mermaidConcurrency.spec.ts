// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarkdownToHtml } from '../../../state/markdownToHtml';
import { renderDiagram } from '../render';

const loadRenderer = vi.fn();
vi.mock('../index', () => ({ default: (...args: unknown[]) => loadRenderer(...args) }));

afterEach(() => {
    loadRenderer.mockReset();
    document.body.replaceChildren();
});

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

function preview(code: string, theme: string) {
    const target = document.createElement('div');
    document.body.append(target);
    const done = renderDiagram({
        type: 'mermaid',
        code,
        target,
        mermaidTheme: theme,
        vegaTheme: 'default',
        plantumlServer: '',
        sequenceTheme: 'simple',
    });
    return { target, done };
}

describe('mermaid render isolation', () => {
    it('keeps each concurrent preview theme until its asynchronous render finishes', async () => {
        let theme = '';
        const started = deferred();
        const release = deferred();
        loadRenderer.mockResolvedValue({
            initialize: (config: { theme: string }) => { theme = config.theme; },
            parse: vi.fn(),
            render: async (_id: string, code: string) => {
                if (code === 'first') {
                    started.resolve();
                    await release.promise;
                }
                return { svg: `<svg><text>${code}:${theme}</text></svg>` };
            },
        });
        const first = preview('first', 'dark');
        await started.promise;
        const second = preview('second', 'default');
        await Promise.resolve();
        await Promise.resolve();
        release.resolve();
        await Promise.all([first.done, second.done]);

        expect(first.target.textContent).toBe('first:dark');
        expect(second.target.textContent).toBe('second:default');
    });

    it('continues rendering after an earlier diagram fails', async () => {
        loadRenderer.mockResolvedValue({
            initialize: vi.fn(),
            parse: vi.fn().mockRejectedValueOnce(new Error('invalid')).mockResolvedValue(undefined),
            render: async () => ({ svg: '<svg><text>valid</text></svg>' }),
        });
        const invalid = preview('invalid', 'dark');
        const valid = preview('valid', 'default');
        await expect(invalid.done).rejects.toThrow('invalid');
        await valid.done;
        expect(valid.target.textContent).toBe('valid');
    });
    it('does not let a live preview change an in-flight HTML export theme', async () => {
        let theme = '';
        const started = deferred();
        const release = deferred();
        loadRenderer.mockResolvedValue({
            initialize: (config: { theme: string }) => { theme = config.theme; },
            run: async ({ nodes }: { nodes: HTMLElement[] }) => {
                started.resolve();
                await release.promise;
                nodes[0].innerHTML = `<svg><text>export:${theme}</text></svg>`;
            },
            parse: vi.fn(),
            render: async () => ({ svg: `<svg><text>preview:${theme}</text></svg>` }),
        });
        const exported = new MarkdownToHtml('```mermaid\ngraph TD; A-->B\n```').renderHtml();
        await started.promise;
        const live = preview('live', 'dark');
        await Promise.resolve();
        await Promise.resolve();
        release.resolve();
        const html = await exported;
        await live.done;
        expect(html).toContain('export:default');
        expect(live.target.textContent).toBe('preview:dark');
    });
});
