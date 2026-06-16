// @vitest-environment happy-dom
import type ParagraphContent from '../../../block/content/paragraphContent';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { zhCN } from '../../../locales';
import { Muya } from '../../../muya';
import { ParagraphQuickInsertMenu } from '../index';

// Characterization of `ParagraphQuickInsertMenu.search()` + `render()`:
//   • `search('')` returns the full MENU_CONFIG (frontmatter included when the
//     cursor block can host front matter — an empty paragraph at the document
//     start with `frontMatter: true`).
//   • `search(localizedFragment)` fuzzy-matches (fuse.js) over each child's
//     `i18nTitle` (i18n.t(title)) and `title`, keeps only sections that have a
//     match, sets `child.i18nTitle`, and sorts the surviving sections by their
//     best child score (ascending = best first).
//   • `search('zzzzz')` yields `renderData === []` and `render()` paints a
//     `.no-result` node carrying the localized "No result".
//
// We boot a real Muya with the zh-CN locale (mirrors localeRefresh.spec /
// updateParagraph.spec), construct the menu directly, and point `menu.block` at
// the booted empty paragraph's content leaf — exactly what `listen()` does when
// the `/` trigger fires.

const bootedHosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length) {
        const host = bootedHosts.pop()!;
        host.remove();
    }
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
        delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, {
        markdown,
        locale: zhCN,
    } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

// Boot the editor over a single empty paragraph and hand back the menu with its
// `block` already pointed at the paragraph's content leaf.
// White-box view onto the menu's private `_block` field and `_search` method,
// which these characterization tests drive directly.
interface IMenuView {
    _block: ParagraphContent | null;
    _search: (text: string) => void;
    renderData: ParagraphQuickInsertMenu['renderData'];
    renderArray: ParagraphQuickInsertMenu['renderArray'];
    scrollElement: ParagraphQuickInsertMenu['scrollElement'];
    activeItem: ParagraphQuickInsertMenu['activeItem'];
}

function bootMenu(): { muya: Muya; menu: IMenuView } {
    const muya = bootMuya('\n');
    const menu = new ParagraphQuickInsertMenu(muya) as unknown as IMenuView;
    const first = muya.editor.scrollPage!.firstContentInDescendant()!;
    menu._block = first as unknown as ParagraphContent;

    return { muya, menu };
}

describe('paragraphQuickInsertMenu search() — zh-CN localized matching', () => {
    it('search("") returns the full menu config (frontmatter included on an empty doc-start paragraph)', () => {
        const { menu } = bootMenu();

        menu._search('');

        const sectionNames = menu.renderData.map(d => d.name);
        expect(sectionNames).toEqual([
            'basic blocks',
            'headers',
            'advanced blocks',
            'list blocks',
            'diagrams',
        ]);

        // An empty paragraph at the document start with frontMatter:true can host
        // front matter, so the basic-blocks section keeps its frontmatter entry.
        const basic = menu.renderData.find(d => d.name === 'basic blocks')!;
        expect(basic.children.map(c => c.label)).toEqual([
            'paragraph',
            'thematic-break',
            'frontmatter',
        ]);
    });

    it('search(localized fragment) keeps only sections whose i18nTitle matched', () => {
        const { menu } = bootMenu();

        // '代码块' is the zh-CN translation of 'Code Block'.
        menu._search('代码');

        expect(menu.renderData.map(d => d.name)).toEqual(['advanced blocks']);
        const matched = menu.renderData[0].children;
        expect(matched.map(c => c.label)).toEqual(['code-block']);
        // search() stamps the localized title onto the matched child.
        expect(matched[0].i18nTitle).toBe('代码块');
        // fuse.js attaches a score to every match.
        expect(typeof matched[0].score).toBe('number');
    });

    it('an exact localized title match scores ~0 and surfaces as the section', () => {
        const { menu } = bootMenu();

        // '表格' is the zh-CN translation of 'Table Block'.
        menu._search('表格');

        // 'table' (advanced blocks) is the exact match and sorts first.
        expect(menu.renderData[0].name).toBe('advanced blocks');
        const best = menu.renderData[0].children[0];
        expect(best.label).toBe('table');
        expect(best.i18nTitle).toBe('表格');
        expect(best.score).toBeLessThan(0.001);
    });

    it('a multi-section match is sorted by best child score (best section first)', () => {
        const { menu } = bootMenu();

        // The character '表' appears in '表格' (Table Block, advanced blocks) and
        // in '任务列表'/etc. (list blocks), so two sections match.
        menu._search('表');

        expect(menu.renderData.length).toBeGreaterThan(1);
        // 'advanced blocks' (table, best score) sorts ahead of 'list blocks'.
        expect(menu.renderData[0].name).toBe('advanced blocks');
        expect(menu.renderData[0].children[0].label).toBe('table');

        // Sections are ordered by ascending best-child score.
        const bestScores = menu.renderData.map(d => d.children[0].score!);
        const sorted = [...bestScores].sort((a, b) => a - b);
        expect(bestScores).toEqual(sorted);
    });

    it('search("zzzzz") yields empty renderData', () => {
        const { menu } = bootMenu();

        menu._search('zzzzz');

        expect(menu.renderData).toEqual([]);
        expect(menu.renderArray).toEqual([]);
    });
});

describe('paragraphQuickInsertMenu render() — DOM output', () => {
    it('a no-match search paints a single localized .no-result node', () => {
        const { menu } = bootMenu();

        // search() calls render() internally; the no-result node lands in the DOM.
        menu._search('zzzzz');

        const noResult = menu.scrollElement!.querySelector('.no-result');
        expect(noResult).not.toBeNull();
        // '无结果' is the zh-CN translation of 'No result'.
        expect(noResult!.textContent).toBe('无结果');
        // No section is rendered when there is no result.
        expect(menu.scrollElement!.querySelectorAll('section').length).toBe(0);
    });

    it('a match renders one <section> per matched group with exactly one .item.active', () => {
        const { menu } = bootMenu();

        menu._search('表');

        const sections = menu.scrollElement!.querySelectorAll('section');
        expect(sections.length).toBe(menu.renderData.length);

        // The first child of the first (best) section is the active item.
        expect(menu.activeItem!.label).toBe('table');
        const active = menu.scrollElement!.querySelectorAll('.item.active');
        expect(active.length).toBe(1);
        expect((active[0] as HTMLElement).dataset.label).toBe('table');
    });

    it('renderArray is the flattened children of every matched section', () => {
        const { menu } = bootMenu();

        menu._search('列表');

        const flattened = menu.renderData.flatMap(d => d.children);
        expect(menu.renderArray).toEqual(flattened);
        // activeItem defaults to the first flattened child.
        expect(menu.activeItem).toBe(menu.renderArray[0]);
    });
});
