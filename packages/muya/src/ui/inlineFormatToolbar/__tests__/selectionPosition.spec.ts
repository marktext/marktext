// @vitest-environment happy-dom
import type { ReferenceElement } from '@floating-ui/dom';
import { afterEach, expect, it, vi } from 'vitest';
import { Muya } from '../../../muya';
import { SelectionType } from '../../../selection/types';
import { InlineFormatToolbar } from '../index';

const editors: Muya[] = [];
const toolbars: InlineFormatToolbar[] = [];
afterEach(() => {
    for (const toolbar of toolbars.splice(0)) toolbar.destroy();
    for (const muya of editors.splice(0)) {
        muya.destroy();
        muya.domNode.remove();
    }
    vi.restoreAllMocks();
});

const rect = (x: number, y: number, width = 120, height = 24) => new DOMRect(x, y, width, height);

function setup() {
    window.MUYA_VERSION = 'test';
    const host = document.createElement('div');
    document.body.append(host);
    const muya = new Muya(host, { markdown: 'selected text\n' });
    muya.init();
    editors.push(muya);
    const toolbar = new InlineFormatToolbar(muya);
    toolbars.push(toolbar);
    const block = muya.editor.scrollPage!.firstContentInDescendant()!;
    block.setCursor(0, 8, true);
    const selection = muya.getSelection();
    if (selection?.kind !== SelectionType.TEXT)
        throw new Error('Expected text selection');
    const show = vi.spyOn(toolbar, 'show').mockImplementation(() => {});
    const emit = (coords = rect(300, 250)) => muya.eventCenter.emit('selection-change', {
        selection: { ...selection, context: { ...selection.context, selectionCoords: coords } },
        docChanged: false,
    });
    return { muya, toolbar, show, emit };
}

it('keeps the last valid selection coordinates if a cloned range collapses during re-render', () => {
    const { show, emit } = setup();
    let live = rect(300, 250);
    vi.spyOn(Range.prototype, 'getBoundingClientRect').mockImplementation(() => live);
    emit();
    const reference = show.mock.lastCall![0] as ReferenceElement;
    expect(reference.getBoundingClientRect().top).toBe(250);
    live = rect(0, 0, 0, 0);
    expect(reference.getBoundingClientRect().top).toBe(250);
    expect(reference.getBoundingClientRect().left).toBe(300);
});

it('continues following a valid range when scrolling changes its position', () => {
    const { show, emit } = setup();
    let live = rect(300, 250);
    vi.spyOn(Range.prototype, 'getBoundingClientRect').mockImplementation(() => live);
    emit();
    const reference = show.mock.lastCall![0] as ReferenceElement;
    live = rect(300, 220);
    expect(reference.getBoundingClientRect().top).toBe(220);
    live = rect(0, 0, 0, 0);
    expect(reference.getBoundingClientRect().top).toBe(220);
});

it('does not open at the origin when the selection has no rendered coordinates', () => {
    const { show, emit } = setup();
    vi.spyOn(Range.prototype, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 0, 0));
    emit(rect(0, 0, 0, 0));
    expect(show).not.toHaveBeenCalled();
});
