import type { Doc, JSONOp, Path } from 'ot-json1';
import type { TSyntaxState } from './syntax';
import { insertOp, type as json1, removeOp, replaceOp } from 'ot-json1';
import { asDoc } from './index';

/** Unrelated source-form properties remain independent paths for OT transforms. */
export function syntaxOperations(path: Path, before: TSyntaxState['syntax'], after: TSyntaxState['syntax']): JSONOp {
    let operation: JSONOp = null;
    const add = (change: JSONOp) => {
        operation = json1.compose(operation, change);
    };
    const equal = (left: Doc, right: Doc) => JSON.stringify(left) === JSON.stringify(right);
    const visit = (prefix: Path, left: Doc, right: Doc) => {
        if (equal(left, right))
            return;
        if (Array.isArray(left) && Array.isArray(right)) {
            let start = 0;
            while (start < Math.min(left.length, right.length) && equal(left[start], right[start])) start++;
            let end = 0;
            while (end < Math.min(left.length, right.length) - start
                && equal(left[left.length - end - 1], right[right.length - end - 1])) {
                end++;
            }
            for (let index = left.length - end - 1; index >= start; index--)
                add(removeOp([...prefix, index]));
            for (let index = start; index < right.length - end; index++)
                add(insertOp([...prefix, index], right[index]));
        }
        else if (left && right && typeof left === 'object' && typeof right === 'object'
            && !Array.isArray(left) && !Array.isArray(right)) {
            for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
                if (!(key in right))
                    add(removeOp([...prefix, key]));
                else if (!(key in left))
                    add(insertOp([...prefix, key], right[key]));
                else
                    visit([...prefix, key], left[key], right[key]);
            }
        }
        else {
            add(replaceOp(prefix, left, right));
        }
    };
    visit([...path, 'syntax'], asDoc(before), asDoc(after));
    return operation;
}
