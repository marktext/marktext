import type { Nullable } from '../../../../types';

import type { ILinkedNode } from '../linkedNode';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LinkedList } from '../linkedList';

interface IMockNode extends ILinkedNode {
    value: number;
}

function createLinkedNode(): IMockNode {
    const value = Math.random();

    return {
        value,
        prev: null,
        next: null,
    };
}

describe('test LinkedList', () => {
    let linkedList: Nullable<LinkedList<IMockNode>> = null;

    beforeEach(() => {
        linkedList = new LinkedList();
    });

    afterEach(() => {
        linkedList = null;
    });

    describe('basic use of append', () => {
        it('should append a node and the length is 1', () => {
            const node1 = createLinkedNode();

            expect(linkedList).not.toBeNull();

            linkedList?.append(node1);

            expect(linkedList?.length).toBe(1);
            expect(linkedList?.head).toEqual(node1);
            expect(linkedList?.tail).toEqual(node1);
        });
    });

    describe('basic use of method append', () => {
        it('should append two nodes and the length is 2', () => {
            const node2 = createLinkedNode();
            const node3 = createLinkedNode();
            linkedList?.append(node2, node3);

            expect(linkedList?.length).toBe(2);
            expect(linkedList?.head).toEqual(node2);
            expect(linkedList?.tail).toEqual(node3);
        });
    });

    describe('basic use of method insertBefore', () => {
        it('should work correctly when insert some nodes', () => {
            const node1 = createLinkedNode();
            const node2 = createLinkedNode();
            const node3 = createLinkedNode();
            linkedList?.insertBefore(node1);

            expect(node1.prev).toBe(null);
            expect(node1.next).toBe(null);
            expect(linkedList?.head).toEqual(node1);
            expect(linkedList?.tail).toEqual(node1);
            linkedList?.insertBefore(node2, node1);
            expect(node2.next).toBe(node1);
            expect(node1.prev).toBe(node2);
            expect(linkedList?.head).toEqual(node2);
            expect(linkedList?.tail).toEqual(node1);
            linkedList?.insertBefore(node3);
            expect(node3.prev).toBe(node1);
            expect(node1.next).toBe(node3);
            expect(linkedList?.tail).toBe(node3);
            expect(linkedList?.length).toBe(3);
        });
    });

    describe('linkedList method `contains`', () => {
        it('should work correctly in LinkedList method `contains`', () => {
            const node = createLinkedNode();
            linkedList?.insertBefore(node);

            expect(linkedList?.contains(node)).toBeTruthy();
        });
    });

    describe('linkedList method `offset`', () => {
        it('should work correctly in LinkedList method `offset`', () => {
            const nodes: Record<string, IMockNode> = {};
            for (const i of [...Array.from({ length: 5 })].map((_, index) => index)) {
                nodes[`node${i}`] = createLinkedNode();
                linkedList?.insertBefore(nodes[`node${i}`]);
                expect(linkedList?.offset(nodes[`node${i}`])).toBe(i);
            }

            const isolatedNode = createLinkedNode();
            expect(linkedList?.offset(isolatedNode)).toBe(-1);
        });
    });

    describe('linkedList method `remove`', () => {
        it('should work correctly in LinkedList method `remove`', () => {
            const node = createLinkedNode();
            linkedList?.append(node);
            expect(linkedList?.contains(node)).toBeTruthy();
            linkedList?.remove(node);
            expect(linkedList?.contains(node)).toBeFalsy();
        });
    });

    describe('linkedList method `find`', () => {
        it('should work correctly in LinkedList method `find`', () => {
            const node = createLinkedNode();
            linkedList?.append(node);
            expect(linkedList?.find(0)).toBe(node);
            expect(linkedList?.find(1)).toBeFalsy();
        });
    });

    describe('linkedList method `forEach`', () => {
        it('should work correctly in LinkedList method `forEach`', () => {
            const nodes: Record<string, IMockNode> = {};
            for (const i of [...Array.from({ length: 5 })].map((_, index) => index)) {
                nodes[`node${i}`] = createLinkedNode();
                linkedList?.insertBefore(nodes[`node${i}`]);
            }
            linkedList?.forEach((node, i) => {
                expect(nodes[`node${i}`]).toBe(node);
            });
        });
    });

    describe('linkedList method `forEachAt`', () => {
        it('should work correctly in LinkedList method `forEachAt`', () => {
            const nodes: Record<string, IMockNode> = {};
            for (const i of [...Array.from({ length: 5 })].map((_, index) => index)) {
                nodes[`node${i}`] = createLinkedNode();
                linkedList?.insertBefore(nodes[`node${i}`]);
            }
            let count = 0;
            linkedList?.forEachAt(1, 2, (node, i) => {
                count++;
                expect(nodes[`node${i}`]).toBe(node);
            });
            expect(count).toBe(2);
        });
    });

    describe('linkedList method `map`', () => {
        it('should work correctly in LinkedList method `map`', () => {
            const nodes: Record<string, IMockNode> = {};
            for (const i of [...Array.from({ length: 5 })].map((_, index) => index)) {
                nodes[`node${i}`] = createLinkedNode();
                linkedList?.insertBefore(nodes[`node${i}`]);
            }

            const array = linkedList?.map((_node, i) => i);
            expect(linkedList?.length).toEqual(array?.length);
        });
    });

    describe('linkedList method `reduce`', () => {
        it('should work correctly in LinkedList method `reduce`', () => {
            const anotherLinkedList = new LinkedList();
            const nodes: Record<string, IMockNode> = {};
            for (const i of [...Array.from({ length: 5 })].map((_, index) => index)) {
                nodes[`node${i}`] = createLinkedNode();
                linkedList?.insertBefore(nodes[`node${i}`]);
            }
            linkedList?.reduce((_acc, node, _i) => {
                anotherLinkedList.insertBefore(node);

                return anotherLinkedList;
            }, anotherLinkedList);

            for (const node of linkedList!.iterator())
                linkedList?.remove(node);

            expect(anotherLinkedList.length).toBe(5);
            expect(linkedList?.length).toBe(0);
        });
    });
});
