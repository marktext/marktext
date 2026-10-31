// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../muya';
import { ParagraphFrontMenu } from '../index';

const bootedHosts: HTMLElement[] = [];
let writeText: ReturnType<typeof vi.fn>;
let write: ReturnType<typeof vi.fn>;

class FakeClipboardItem {
    constructor(public items: Record<string, Blob>) {}
}

beforeEach(() => {
    window.MUYA_VERSION = 'test';
    vi.useFakeTimers();
    writeText = vi.fn().mockResolvedValue(undefined);
    write = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText, write } });
    vi.stubGlobal('ClipboardItem', FakeClipboardItem);
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
});

function openMenu(markdown: string, index = 0) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown, frontMatter: true } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);

    const menu = new ParagraphFrontMenu(muya);
    let block = muya.editor.scrollPage!.firstChild;
    for (let i = 0; i < index; i++)
        block = block!.next;
    muya.eventCenter.emit('muya-front-menu', { reference: muya.domNode, block });
    vi.runAllTimers();

    return { muya, menu };
}

async function copyBlock(markdown: string, label: string, index = 0) {
    const { muya, menu } = openMenu(markdown, index);
    menu.selectItem(new Event('click'), { label });
    await vi.runAllTimersAsync();

    return muya;
}

describe('paragraph front menu: Copy as', () => {
    it('copies a code block as Markdown with its fences', async () => {
        await copyBlock('```js\nconst a = 1;\n```\n', 'copy-as-markdown');
        expect(writeText).toHaveBeenCalledWith('```js\nconst a = 1;\n```\n');
    });

    it('copies display math with its delimiters', async () => {
        await copyBlock('$$\na^2\n$$\n', 'copy-as-markdown');
        expect(writeText).toHaveBeenCalledWith('$$\na^2\n$$\n');
    });

    it('copies a whole table as a GFM table', async () => {
        await copyBlock('| a | b |\n| --- | --- |\n| 1 | 2 |\n', 'copy-as-markdown');
        expect(writeText.mock.calls[0][0]).toMatch(/^\| a +\| b +\|\n\| -+ \| -+ \|\n\| 1 +\| 2 +\|\n$/);
    });

    it('copies only the chosen block', async () => {
        await copyBlock('first\n\nsecond\n', 'copy-as-markdown', 1);
        expect(writeText).toHaveBeenCalledWith('second\n');
    });

    it('copies HTML as markup in plain text', async () => {
        await copyBlock('**bold**\n', 'copy-as-html');
        expect(writeText.mock.calls[0][0]).toContain('<strong>bold</strong>');
    });

    it('copies Rich Text as HTML with the Markdown alongside', async () => {
        await copyBlock('**bold**\n', 'copy-as-rich');
        const { items } = write.mock.calls[0][0][0] as FakeClipboardItem;
        expect(await items['text/html'].text()).toContain('<strong>bold</strong>');
        expect(await items['text/plain'].text()).toBe('**bold**\n');
    });

    it('leaves the document unchanged', async () => {
        const muya = await copyBlock('first\n\nsecond\n', 'copy-as-markdown');
        expect(muya.getMarkdown()).toBe('first\n\nsecond\n');
    });

    it('offers Copy as on blocks but not on front matter', () => {
        const { menu: paragraphMenu } = openMenu('text\n');
        expect(paragraphMenu.container!.querySelectorAll('.copy-as-menu > li')).toHaveLength(3);

        const { menu: frontMatterMenu } = openMenu('---\ntitle: x\n---\n\ntext\n');
        expect(frontMatterMenu.container!.querySelector('.copy-as')).toBeNull();
    });
});
