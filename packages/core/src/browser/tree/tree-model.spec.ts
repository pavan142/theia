/*
 * Copyright (C) 2018 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { enableJSDOM } from '../../browser/test/jsdom';

const disableJSDOM = enableJSDOM();

import { expect } from 'chai';
import { Container } from 'inversify';
import { TreeModel } from './tree-model';
import { notEmpty } from '../../common/objects';
import { MOCK_ROOT } from './test/mock-tree-model';
import { ExpandableTreeNode } from './tree-expansion';
import { createTreeContainer } from './tree-container';
import { SelectableTreeNode } from './tree-selection';

disableJSDOM();

// tslint:disable:no-unused-expression
// tslint:disable:max-line-length

describe('tree-model', () => {

    const model: TreeModel = createTreeContainer(new Container({ defaultScope: 'Singleton' })).get(TreeModel);
    const findNode = (id: string) => model.getNode(id) as (SelectableTreeNode & ExpandableTreeNode) || {
        id: 'missing',
        name: 'missing',
        selected: false,
        parent: undefined,
        expanded: true
    };

    beforeEach(() => {
        model.root = MOCK_ROOT();
        model.setSelection([]);
        expect(model.selectedNodes).to.be.empty;
    });

    describe('selectNode', () => {

        it('should not update the selection when selecting an invalid node', () => {
            selectNodes('missing');
            expectSelectionState([]);
        });

        it('should update the selection when selecting an existing node', () => {
            selectNodes('1');
            expectSelectionState(['1']);
        });

        it('should not update the selection but should keep the previous state if selecting and invalid node', () => {
            selectNodes('1');
            expectSelectionState(['1']);

            selectNodes('missing');
            expectSelectionState(['1']);
        });

        it('should keep the order of the selected nodes', () => {
            selectNodes('1');
            expectSelectionState(['1']);

            selectNodes('1.1');
            expectSelectionState(['1.1', '1']);
        });

        it('should not change the selection if the node is already selected', () => {
            selectNodes('1', '1.1');
            expectSelectionState(['1.1', '1']);

            selectNodes('1.1');
            expectSelectionState(['1.1', '1']);
        });

    });

    describe('unselectNode', () => {

        it('should not alter the selection state if the node is not valid', () => {
            selectNodes('1');
            expectSelectionState(['1']);

            unselectNodes('missing');
            expectSelectionState(['1']);
        });

        it('should remove the selection from a valid node', () => {
            selectNodes('1');
            expectSelectionState(['1']);

            unselectNodes('1');
            expectSelectionState([]);
            expectNotSelected('1');
        });

        it('should keep the selection order after remove the selection from a valid node', () => {
            selectNodes('1', '1.1', '1.2');
            expectSelectionState(['1.2', '1.1', '1']);

            unselectNodes('1.1');
            expectSelectionState(['1.2', '1']);
            expectNotSelected('1.1');
        });

    });

    describe('toggleSelection', () => {

        it('should have no effect when toggling the selection state of an invalid node', () => {
            selectNodes('1', '1.1', '1.2');
            expectSelectionState(['1.2', '1.1', '1']);

            toggleSelection('missing');
            expectSelectionState(['1.2', '1.1', '1']);
        });

        it('should unselect an already selected node', () => {
            selectNodes('1', '1.1', '1.2');
            expectSelectionState(['1.2', '1.1', '1']);

            toggleSelection('1.1');
            expectSelectionState(['1.2', '1']);
        });

        it('should select a node that was not selected before', () => {
            selectNodes('1', '1.2');
            expectSelectionState(['1.2', '1']);

            toggleSelection('1.1');
            expectSelectionState(['1.1', '1.2', '1']);
        });

    });

    describe('selectRange', () => {
        ([
            {
                to: 'missing',
                from: '1',
                expected: []
            },
            {
                to: '1',
                from: 'missing',
                expected: []
            },
            {
                to: '1',
                from: '1',
                expected: []
            },
            {
                to: '1.3',
                from: '1.2.1.2',
                expected: ['1.2.1.2', '1.2.2', '1.2.3', '1.3']
            },
            {
                to: '1.2.1.2',
                from: '1.3',
                expected: ['1.3', '1.2.3', '1.2.2', '1.2.1.2']
            },
            {
                to: '1.1.2',
                from: '1.3',
                expected: ['1.3', '1.2.3', '1.2.2', '1.2.1', '1.2', '1.1.2'],
                collapsed: ['1.2.1']
            }
        ] as { from: string, to: string, expected: string[], collapsed?: string[] }[]).forEach(test => {
            const collapsed = test.collapsed && test.collapsed.length > 0 ? ` | Collapsed nodes: [${test.collapsed.join(', ')}]` : '';
            it(`should calculate the range between '${test.from}' and '${test.to}' => [${test.expected.join(', ')}]${collapsed}`, () => {
                if (test.collapsed) {
                    collapseNode(...test.collapsed);
                }
                expect(calculateRange(test.to, test.from).map(node => node.id)).to.be.deep.equal(test.expected);
            });
        });

    });

    describe('selectRange', () => {
        ([
            {
                to: '1.3',
                from: '1.2.1.2',
                selections: ['1.2.3'],
                expected: ['1.3', '1.2.3', '1.2.2', '1.2.1.2']
            },
            {
                to: '1.1.2',
                from: '1.3',
                selections: ['1.2'],
                collapsed: ['1.2.1'],
                expected: ['1.1.2', '1.2', '1.2.1', '1.2.2', '1.2.3', '1.3']
            },
            {
                to: '1.2.1',
                from: '1.2.3',
                selections: ['1.2.2'],
                collapsed: ['1.2.1'],
                expected: ['1.2.1', '1.2.2', '1.2.3']
            }
        ] as { from: string, to: string, selections: string[], expected: string[], collapsed?: string[] }[]).forEach(test => {
            const collapsed = test.collapsed && test.collapsed.length > 0 ? ` | Collapsed nodes: [${test.collapsed.join(', ')}]` : '';
            it(`should select the range between '${test.from}' and '${test.to}' => [${test.expected.join(', ')}]${collapsed}`, () => {
                if (test.collapsed) {
                    collapseNode(...test.collapsed);
                }
                selectRange(test.to, test.from);
                expectSelectionState(test.expected);
            });
        });

        it('should handle consecutive range selections - the second selection is a subset of the first', () => {
            selectNodes('1.1.2', '1');
            expectSelectionState(['1', '1.1.2']);

            selectRange('1.2.3', '1.2.1');
            expectSelectionState(['1.2.3', '1.2.2', '1.2.1.2', '1.2.1.1', '1.2.1', '1', '1.1.2']);

            selectRange('1.2.1.2', '1.2.1');
            expectSelectionState(['1.2.1.2', '1.2.1.1', '1.2.1', '1', '1.1.2']);

            // var prevState = [1.2.3, 1.2.2, 1.2.1.2, 1.2.1.1, 1.2.1, 1, 1.1.2]
            // var selRange = [1.2.1, 1.2.1.1, 1.2.1.2]
            // exp: [1.2.1.2, 1.2.1.1, 1.2.1, 1, 1.1.2]

            //
            // var prevState = [J, I, H, G, F, A, D]
            // var selRange = [F, G, H]
            // exp: [H, G, F, A, D]

            // XXX: shift from left to right the reverse of the last input
            // We can decide whether the prev selection was a range and contained

            // Lookup table:
            // A 1
            // B 1.1
            // C 1.1.1
            // D 1.1.2
            // E 1.2
            // F 1.2.1
            // G 1.2.1.1
            // H 1.2.1.2
            // I 1.2.2
            // J 1.2.3
            // K 1.3
        });

    });

    function expectSelectionState(ids: string[]): void {
        const actual = model.selectedNodes.map(node => node.id);
        const expected = ids;
        expect(actual).to.be.deep.equal(expected, `Expected: [${expected.join(', ')}], was: [${actual.join(', ')}].`);
    }

    function expectNotSelected(...ids: string[]): void {
        ids.map(findNode).forEach(node => expect(node.selected).to.be.equal(false, `Expected unselected tree node with ID: ${node.id}.`));
    }

    function selectNodes(...ids: string[]): void {
        ids.map(findNode).forEach(node => model.selectNode(node, true));
    }

    function unselectNodes(...ids: string[]): void {
        ids.map(findNode).forEach(node => model.unselectNode(node));
    }

    function toggleSelection(...ids: string[]): void {
        ids.map(findNode).forEach(node => model.toggleSelection(node));
    }

    function selectRange(toId: string, fromId?: string): void {
        model.selectRange(findNode(toId), fromId === undefined ? undefined : findNode(fromId), true);
    }

    function calculateRange(toId: string, fromId: string): ReadonlyArray<Readonly<SelectableTreeNode>> {
        return model.selectionRange(findNode(toId), findNode(fromId));
    }

    function collapseNode(...ids: string[]): void {
        ids.map(findNode).filter(notEmpty).filter(ExpandableTreeNode.is).forEach(node => {
            model.collapseNode(node as ExpandableTreeNode);
            expect(node).to.have.property('expanded', false);
        });
    }

});
