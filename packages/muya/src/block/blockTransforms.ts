import type { Muya } from '../muya';
import type { IFrontmatterMeta } from '../state/types';
import type Parent from './base/parent';
import emptyStates from '../config/emptyStates';
import { getCursorReference } from '../selection';
import { isParagraphState } from '../state/types';
import { deepClone } from '../utils';
import logger from '../utils/logger';
import { ScrollPage } from './scrollPage';

const debug = logger('quickInsert:');

/**
 * Derive the frontmatter `lang`/`style` from the user's `frontmatterType`
 * preference: `-` -> yaml `---`, `+` -> toml `+++`,
 * `;`/`{` -> json (`;;;`/`{}`). The serializer (`serializeFrontMatter`)
 * switches on `lang`, so getting `lang` right is what makes YAML/TOML emit
 * their fences instead of falling through to JSON braces.
 */
export function frontmatterMeta(frontmatterType: string): IFrontmatterMeta {
    switch (frontmatterType) {
        case '+':
            return { lang: 'toml', style: '+' };
        case ';':
            return { lang: 'json', style: ';' };
        case '{':
            return { lang: 'json', style: '{' };
        case '-':
        default:
            return { lang: 'yaml', style: '-' };
    }
}

/**
 * Prepend a front matter block at the very start of the document. Front matter
 * is only valid as the first
 * block, so this never replaces the block at the cursor. Idempotent: a no-op
 * when the document already starts with front matter, so it never duplicates
 * the block. Shared by `Muya.updateParagraph('front-matter')` and the
 * quick-insert menu's `frontmatter` entry so both follow identical semantics.
 */
export function insertFrontMatterAtStart(muya: Muya): boolean {
    const { scrollPage } = muya.editor;
    if (!scrollPage)
        return false;

    const firstBlock = scrollPage.firstChild as Parent | null;
    if (firstBlock?.blockName === 'frontmatter')
        return false;

    const fmState = deepClone(emptyStates.frontmatter);
    Object.assign(fmState.meta, frontmatterMeta(muya.options.frontmatterType));

    const frontmatter = ScrollPage.loadBlock('frontmatter').create(muya, fmState);
    scrollPage.insertBefore(frontmatter, firstBlock);
    frontmatter.firstContentInDescendant()?.setCursor(0, 0, true);

    return true;
}

/**
 * Show the in-editor table grid picker. The in-editor "table" insert (the `/`
 * quick-insert menu and the paragraph front-menu) must offer a hover-grid
 * dimension picker rather than dropping a fixed-size table — the picker UI
 * (`TableChessboard`) subscribes to `muya-table-picker` and invokes the
 * dispatched callback with the zero-based `(row, column)` the user picked, so
 * the table is created at `row + 1 × column + 1` to match legacy semantics.
 *
 * The float anchors to the caret (`getCursorReference`); when the cursor has
 * no coords (e.g. the front-menu took focus) it falls back to the block's DOM
 * node. No-op if neither is available.
 */
export function showTablePicker(muya: Muya, block: Parent) {
    const { eventCenter } = muya;
    const reference = getCursorReference() ?? block.domNode;
    if (!reference)
        return;

    const handler = (row: number, column: number) => {
        // The picker's trigger block (a `/table` quick-insert line or the empty
        // paragraph the front-menu offers) is disposable, so always replace it
        // rather than inserting the table below it.
        muya.createTable({ rows: row + 1, columns: column + 1 }, { replace: true });
    };

    eventCenter.emit('muya-table-picker', { row: -1, column: -1 }, reference, handler);
}

type TLeafReplacementLabel
    = | 'paragraph'
        | 'thematic-break'
        | 'math-block'
        | 'html-block'
        | 'code-block'
        | 'block-quote';

function buildLeafBlock(label: TLeafReplacementLabel, muya: Muya, text: string) {
    const cloned = deepClone(emptyStates[label]);
    if (cloned.name === 'paragraph') {
        cloned.text = text;
    }
    else if (cloned.name === 'block-quote') {
        const inner = cloned.children[0];
        if (isParagraphState(inner))
            inner.text = text;
    }

    return ScrollPage.loadBlock(label).create(muya, cloned);
}

function buildHeadingBlock(label: string, muya: Muya, text: string) {
    const headingState = deepClone(emptyStates['atx-heading']);

    const [blockName, level] = label.split(' ');
    headingState.meta.level = +level;
    headingState.text = `${'#'.repeat(+level)} ${text}`;

    return ScrollPage.loadBlock(blockName).create(muya, headingState);
}

function buildOrderListBlock(muya: Muya, text: string) {
    const { preferLooseListItem, orderListDelimiter } = muya.options;
    const orderState = deepClone(emptyStates['order-list']);
    orderState.meta.loose = preferLooseListItem;
    orderState.meta.delimiter = orderListDelimiter;
    const firstChild = orderState.children[0].children[0];
    if (text && isParagraphState(firstChild))
        firstChild.text = text;

    return ScrollPage.loadBlock('order-list').create(muya, orderState);
}

function buildListBlock(label: 'bullet-list' | 'task-list', muya: Muya, text: string) {
    const { preferLooseListItem, bulletListMarker } = muya.options;
    const listState = deepClone(emptyStates[label]);
    listState.meta.loose = preferLooseListItem;
    listState.meta.marker = bulletListMarker;
    const firstChild = listState.children[0].children[0];
    if (text && isParagraphState(firstChild))
        firstChild.text = text;

    return ScrollPage.loadBlock(label).create(muya, listState);
}

function buildDiagramBlock(label: string, muya: Muya) {
    const diagramState = deepClone(emptyStates.diagram);

    const [name, type] = label.split(' ');
    if (
        type === 'mermaid'
        || type === 'plantuml'
        || type === 'vega-lite'
        || type === 'flowchart'
        || type === 'sequence'
    ) {
        diagramState.meta.type = type;
        diagramState.meta.lang = type === 'vega-lite' ? 'json' : 'yaml';
    }

    return ScrollPage.loadBlock(name).create(muya, diagramState);
}

export function buildReplacementBlock(label: string, muya: Muya, text: string) {
    if (label.startsWith('atx-heading '))
        return buildHeadingBlock(label, muya, text);
    if (label.startsWith('diagram '))
        return buildDiagramBlock(label, muya);

    switch (label) {
        case 'paragraph':
            // fall through
        case 'thematic-break':
            // fall through
        case 'math-block':
            // fall through
        case 'html-block':
            // fall through
        case 'code-block':
            // fall through
        case 'block-quote':
            return buildLeafBlock(label, muya, text);

        case 'order-list':
            return buildOrderListBlock(muya, text);

        case 'bullet-list':
            // fall through
        case 'task-list':
            return buildListBlock(label, muya, text);

        default:
            debug.log('Unknown label in quick insert');
            return null;
    }
}

export function replaceBlockByLabel({ block, muya, label, text = '' }: {
    block: Parent;
    muya: Muya;
    label: string;
    text?: string;
}) {
    // Front matter is only valid as the document's first block, so the
    // quick-insert "Front Matter" entry must NOT replace the cursor block in
    // place (which destroyed its content and produced invalid mid-document
    // front matter). Prepend at document start and bail before the in-place
    // `block.replaceWith` below — sharing the idempotent doc-start logic with
    // `Muya.updateParagraph('front-matter')`.
    if (label === 'frontmatter') {
        // Every other label drops the `/` quick-insert trigger text implicitly
        // via `block.replaceWith(newBlock)`. Front matter is prepended at the
        // document start instead (the trigger paragraph survives), so clear its
        // `/…` text and refresh the DOM. Only do so when a block was actually
        // inserted — when the document already starts with front matter the
        // insert is a no-op and the trigger paragraph must be left untouched.
        if (insertFrontMatterAtStart(muya)) {
            const triggerContent = block.firstContentInDescendant();
            if (triggerContent) {
                triggerContent.text = '';
                triggerContent.update();
            }
        }
        return;
    }

    // The in-editor "table" insert shows a hover-grid dimension picker
    // instead of dropping a fixed-size
    // table. The picker's callback creates the table at the chosen size, so
    // bail before the in-place empty-table replacement below.
    if (label === 'table') {
        showTablePicker(muya, block);
        return;
    }

    const newBlock = buildReplacementBlock(label, muya, text);

    block.replaceWith(newBlock);
    finishInsertedBlock(newBlock, muya, label);
}

// Position the caret after a block was inserted or replaced. A thematic-break
// is not editable, so append a trailing empty paragraph and put the caret there
// (so the user can keep typing below the rule); otherwise move the caret into
// the new block.
function finishInsertedBlock(newBlock: Parent, muya: Muya, label: string) {
    if (label === 'thematic-break') {
        const nextParagraphBlock = ScrollPage.loadBlock('paragraph').create(
            muya,
            deepClone(emptyStates.paragraph),
        );
        newBlock.parent!.insertAfter(nextParagraphBlock, newBlock);
        nextParagraphBlock.firstContentInDescendant()?.setCursor(0, 0, true);
        return;
    }

    placeCaretInNewBlock(newBlock, label);
}

// Move the caret into a freshly-built block: between <div>\n\n</div> for an
// html-block, otherwise to the end of its text.
function placeCaretInNewBlock(newBlock: Parent, label: string) {
    const cursorBlock = newBlock.firstContentInDescendant();
    if (!cursorBlock)
        return;

    const offset = label === 'html-block' ? 6 : cursorBlock.text.length;
    cursorBlock.setCursor(offset, offset, true);
}

// Build a fresh block of `label` and insert it directly AFTER `block`
// (inside the same container), then move the caret into the new block.
// Used by the Paragraph menu when the target type is not a valid front-menu
// turn-into of a non-empty block.
export function insertBlockBelowByLabel({ block, muya, label }: {
    block: Parent;
    muya: Muya;
    label: string;
}) {
    const newBlock = buildReplacementBlock(label, muya, '');
    if (!newBlock)
        return;
    block.parent!.insertAfter(newBlock, block);
    finishInsertedBlock(newBlock, muya, label);
}

// Whether `block` can be turned into `label` in place (the front-menu's
// turn-into set). The label-matching regexes are the single source of truth and
// must stay in sync with `MENU_CONFIG`'s labels and `PARAGRAPH_LABEL_MAP`.
export function canTurnInto(block: Parent, label: string): boolean {
    const { blockName } = block;

    switch (blockName) {
        case 'paragraph': {
            const paragraphIsEmpty = /^\s*$/.test(block.firstContentInDescendant()!.text);
            if (paragraphIsEmpty)
                return label !== 'frontmatter';

            return /paragraph|atx-heading|block-quote|order-list|bullet-list|task-list/.test(label);
        }

        case 'atx-heading':
            return /atx-heading|paragraph/.test(label);

        case 'order-list':
            // fall through
        case 'bullet-list':
            // fall through
        case 'task-list':
            return /order-list|bullet-list|task-list/.test(label);

        default:
            return false;
    }
}
