import type Content from './base/content';
import type Parent from './base/parent';
import type TreeNode from './base/treeNode';
import type { IFoldableHeading } from './commonMark/atxHeading/foldSection';
import { CLASS_NAMES } from '../config';
import { headingLevel, hiddenByFoldedSections, isFoldableHeading } from './commonMark/atxHeading/foldSection';

// A stable tail keeps newly inserted content after a folded section visible.
const foldEnds = new WeakMap<IFoldableHeading, TreeNode>();
const foldedParents = new WeakSet<Parent>();

/** Recompute direct-child visibility; nested containers own their own folds. */
export function refreshFoldVisibility(parent: Parent, foldChanged = false): void {
    // Ordinary document edits need no sibling scan until a fold has been activated.
    if (!foldChanged && !foldedParents.has(parent))
        return;
    const blocks = [...parent.children.iterator()];
    const indices = new Map(blocks.map((block, index) => [block, index]));
    const hidden = hiddenByFoldedSections(blocks.map((block, index) => {
        const level = headingLevel(block);
        if (!isFoldableHeading(block))
            return { blockName: block.blockName, level };
        if (!block.folded) {
            foldEnds.delete(block);
            return { blockName: block.blockName, level };
        }

        let end = foldEnds.get(block);
        if (!end) {
            end = block;
            for (let next = block.next; next; next = next.next) {
                const nextLevel = headingLevel(next);
                if (nextLevel !== undefined && nextLevel <= block.meta.level)
                    break;
                end = next;
            }
        }
        // Removed nodes retain their old prev link until they are inserted elsewhere.
        while (end !== block && end.parent !== parent)
            end = end.prev ?? block;
        foldEnds.set(block, end);
        return { blockName: block.blockName, level, folded: true, foldEnd: indices.get(end) ?? index };
    }));
    if (blocks.some(block => isFoldableHeading(block) && block.folded))
        foldedParents.add(parent);
    else
        foldedParents.delete(parent);
    blocks.forEach((block, index) => {
        block.domNode?.classList.toggle(CLASS_NAMES.MU_FOLDED_CONTENT, hidden[index]);
    });
}

/** Reveal a target without unfolding unrelated sections or the target heading itself. */
export function revealBlock(block: TreeNode): void {
    if (!block.domNode?.closest(`.${CLASS_NAMES.MU_FOLDED_CONTENT}`))
        return;

    let target: TreeNode = block;
    while (target.parent && !target.isScrollPage) {
        const folded: IFoldableHeading[] = [];
        const siblings = [...target.parent.children.iterator()];
        const targetIndex = siblings.indexOf(target);
        for (const sibling of siblings) {
            const level = headingLevel(sibling);
            if (level !== undefined) {
                while (folded.length && folded[folded.length - 1].meta.level >= level)
                    folded.pop();
            }
            if (sibling === target)
                break;
            if (isFoldableHeading(sibling) && sibling.folded) {
                const end = foldEnds.get(sibling);
                if (!end || siblings.indexOf(end) >= targetIndex)
                    folded.push(sibling);
            }
        }
        for (const heading of folded)
            heading.toggleFold(false);
        target = target.parent;
    }
}

/** Ordinary caret navigation skips folded sections without changing their state. */
export function visibleContentInContext(block: TreeNode, direction: 'previous' | 'next'): Content | null {
    let content = direction === 'previous' ? block.previousContentInContext() : block.nextContentInContext();
    while (content?.domNode?.closest(`.${CLASS_NAMES.MU_FOLDED_CONTENT}`))
        content = direction === 'previous' ? content.previousContentInContext() : content.nextContentInContext();
    return content ?? null;
}

/** Find-in-document exposes all content, including sections without a match. */
export function unfoldAllSections(root: Parent): void {
    root.depthFirstTraverse((block) => {
        if (isFoldableHeading(block) && block.folded)
            block.toggleFold(false);
    });
}
