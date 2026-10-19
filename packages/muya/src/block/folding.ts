import type Parent from './base/parent';
import type TreeNode from './base/treeNode';
import type { IFoldableHeading } from './commonMark/atxHeading/foldSection';
import { CLASS_NAMES } from '../config';
import { headingLevel, hiddenByFoldedSections, isFoldableHeading } from './commonMark/atxHeading/foldSection';

// A stable tail keeps newly inserted content after a folded section visible.
const foldEnds = new WeakMap<IFoldableHeading, TreeNode>();
const foldedParents = new WeakSet<Parent>();
// Parent-owned snapshots avoid rescanning siblings for every skipped content block.
const hiddenBlocksByParent = new WeakMap<Parent, WeakSet<TreeNode>>();

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
    hiddenBlocksByParent.set(parent, new WeakSet(blocks.filter((_, index) => hidden[index])));
    blocks.forEach((block, index) => {
        block.domNode?.classList.toggle(CLASS_NAMES.MU_FOLDED_CONTENT, hidden[index]);
    });
}

function getContainingFoldedHeadings(block: TreeNode): IFoldableHeading[] {
    const containing: IFoldableHeading[] = [];
    let target = block;
    while (target.parent && !target.isScrollPage) {
        if (!foldedParents.has(target.parent)) {
            target = target.parent;
            continue;
        }
        const folded: IFoldableHeading[] = [];
        const siblings = [...target.parent.children.iterator()];
        const indices = new Map(siblings.map((sibling, index) => [sibling, index]));
        const targetIndex = indices.get(target)!;
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
                if (!end || (indices.get(end) ?? -1) >= targetIndex)
                    folded.push(sibling);
            }
        }
        containing.push(...folded);
        target = target.parent;
    }
    return containing;
}

/** Includes enclosing containers and the captured boundaries of folded sections. */
export function isHiddenByFold(block: TreeNode): boolean {
    let target = block;
    while (target.parent && !target.isScrollPage) {
        if (hiddenBlocksByParent.get(target.parent)?.has(target))
            return true;
        target = target.parent;
    }
    return false;
}

/** Reveal a target without unfolding unrelated sections or the target heading itself. */
export function revealBlock(block: TreeNode): void {
    if (!isHiddenByFold(block))
        return;
    for (const heading of getContainingFoldedHeadings(block))
        heading.toggleFold(false);
}

/** Find-in-document exposes all content, including sections without a match. */
export function unfoldAllSections(root: Parent): void {
    root.depthFirstTraverse((block) => {
        if (isFoldableHeading(block) && block.folded)
            block.toggleFold(false);
    });
}
