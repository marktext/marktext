// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import { bootMuya, useMuyaHarness } from '../../../../__tests__/muyaHarness';
import { ScrollPage } from '../../../scrollPage';

useMuyaHarness();

function clickToggle(muya: ReturnType<typeof bootMuya>, index = 0): void {
    muya.domNode.querySelectorAll('.mu-fold-toggle')[index]
        .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

describe('heading fold view snapshots', () => {
    it('restores nested folds after rebuilding without changing document state or history', () => {
        const markdown = '# A\n\nalpha\n\n## B\n\nbeta\n\n# C\n';
        const muya = bootMuya(markdown);
        const json = muya.getState();
        clickToggle(muya, 1);
        clickToggle(muya);
        const folds = muya.getHeadingFoldState();
        expect(folds).toHaveLength(2);

        muya.setContent('# Other\n\nother\n');
        expect(muya.getHeadingFoldState()).toEqual([]);
        muya.setContent(markdown);
        const changed = vi.fn();
        muya.on('json-change', changed);
        const history = muya.getHistory();
        muya.setHeadingFoldState(folds);

        expect(muya.domNode.querySelectorAll('.mu-folded-content')).toHaveLength(3);
        clickToggle(muya);
        expect([...muya.domNode.querySelectorAll('.mu-folded-content')].map(node => node.textContent)).toEqual(['beta']);
        expect(muya.getMarkdown()).toBe(markdown);
        expect(muya.getState()).toEqual(json);
        expect(muya.getHistory()).toEqual(history);
        expect(changed).not.toHaveBeenCalled();
    });

    it('restores headings inside containers with duplicate titles', () => {
        const markdown = '> # A\n>\n> alpha\n\n# A\n\nbeta\n';
        const muya = bootMuya(markdown);
        clickToggle(muya);
        const folds = muya.getHeadingFoldState();
        muya.setContent(markdown);
        muya.setHeadingFoldState(folds);

        expect([...muya.domNode.querySelectorAll('.mu-folded-content')].map(node => node.textContent)).toEqual(['alpha']);
        expect(muya.domNode.querySelectorAll('.mu-fold-toggle')[1].getAttribute('aria-expanded')).toBe('true');
        expect(muya.getHeadingFoldState()).toEqual(folds);
    });

    it('preserves captured tails when an edited boundary no longer ends the section', () => {
        const muya = bootMuya('# A\n\nalpha\n\n# B\n\nbeta\n');
        clickToggle(muya);
        const boundary = muya.editor.scrollPage!.children.tail!.prev!;
        if (!boundary.isParent())
            throw new Error('Expected heading block');
        boundary.replaceWith(ScrollPage.loadBlock('atx-heading').create(muya, { name: 'atx-heading', text: '## B', meta: { level: 2 } }));
        muya.flush();
        const folds = muya.getHeadingFoldState();
        muya.setContent(muya.getMarkdown());
        muya.setHeadingFoldState(folds);

        expect([...muya.domNode.querySelectorAll('.mu-folded-content')].map(node => node.textContent)).toEqual(['alpha']);
        muya.setHeadingFoldState([]);
        expect(muya.domNode.querySelectorAll('.mu-folded-content')).toHaveLength(0);
        expect(muya.getHeadingFoldState()).toEqual([]);
    });
});
