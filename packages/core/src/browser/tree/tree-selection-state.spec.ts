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
import { MOCK_ROOT } from './test/mock-tree-model';
import { ExpandableTreeNode } from './tree-expansion';
import { createTreeContainer } from './tree-container';
import { TreeSelectionState } from './tree-selection-state';
import { SelectableTreeNode, TreeSelection } from './tree-selection';

disableJSDOM();

// tslint:disable:no-unused-expression
// tslint:disable:max-line-length

describe('tree-selection-state', () => {

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
        expect(model.selectedNodes).to.be.empty;
    });

    it('01', () => {
        expectState(newState()
            .nextState(toggleSelection('1.1'))
            .nextState(toggleSelection('1.1.2'))
            .nextState(toggleSelection('1.2.1.1'))
            .nextState(toggleSelection('1.2'))
            .nextState(rangeSelection('1.3')), [
                '1.3', '1.2.3', '1.2.2', '1.2.1.2', '1.2.1.1', '1.2.1', '1.2', '1.1.2', '1.1'
            ]);
    });

    it('02', () => {
        expectState(newState()
            .nextState(toggleSelection('1.1'))
            .nextState(toggleSelection('1.2.1.1'))
            .nextState(rangeSelection('1.2.3'))
            .nextState(rangeSelection('1.2.1.2')), [
                '1.2.1.2', '1.2.1.1', '1.1'
            ]);
    });

    it('03', () => {
        expectState(newState()
            .nextState(toggleSelection('1.1'))
            .nextState(toggleSelection('1.2.1.1'))
            .nextState(rangeSelection('1.2.3'))
            .nextState(rangeSelection('1.2.1')), [
                '1.2.1', '1.2.1.1', '1.1'
            ]);
    });

    it('04', () => {
        expectState(newState()
            .nextState(toggleSelection('1.1'))
            .nextState(toggleSelection('1.2.1.1'))
            .nextState(toggleSelection('1.1')), [
                '1.2.1.1'
            ]);
    });

    it('05', () => {
        expectState(newState()
            .nextState(toggleSelection('1.1'))
            .nextState(toggleSelection('1.1.2'))
            .nextState(toggleSelection('1.2.1.2'))
            .nextState(rangeSelection('1.2.3'))
            .nextState(toggleSelection('1.2.2')), [
                '1.2.3', '1.2.1.2', '1.1.2', '1.1'
            ]);
    });

    it('06', () => {
        expectState(newState()
            .nextState(toggleSelection('1.2.2'))
            .nextState(rangeSelection('1.2.1'))
            .nextState(rangeSelection('1.2.3'))
            .nextState(rangeSelection('1.1'))
            .nextState(toggleSelection('1.1.2'))
            .nextState(toggleSelection('1.2.1.1'))
            .nextState(toggleSelection('1.2.1.1'))
            .nextState(rangeSelection('1.2')), [

            ]);
    });

    it('07', () => {
        expectState(newState()
            .nextState(toggleSelection('1.2.2'))
            .nextState(rangeSelection('1.1.1'))
            .nextState(toggleSelection('1.1.2'))
            .nextState(rangeSelection('1.2.3')), [

            ]);
    });

    it('08', () => {
        expectState(newState()
            .nextState(toggleSelection('1.2.2'))
            .nextState(toggleSelection('1.2.1.1'))
            .nextState(rangeSelection('1.1.1'))
            .nextState(rangeSelection('1.2.3')), [

            ]);
    });

    it('09', () => {
        expectState(newState()
            .nextState(toggleSelection('1.2.3'))
            .nextState(rangeSelection('1.2.3'))
            .nextState(toggleSelection('1.2.1.1'))
            .nextState(toggleSelection('1.2.1.2'))
            .nextState(toggleSelection('1.2.1'))
            .nextState(toggleSelection('1.2'))
            .nextState(rangeSelection('1.1')), [

            ]);
    });

    function newState() {
        return new TreeSelectionState(model);
    }

    function defaultSelection(id: string, type: TreeSelection.SelectionType = TreeSelection.SelectionType.DEFAULT): TreeSelection {
        const node = findNode(id);
        return {
            node,
            type
        };
    }

    function toggleSelection(id: string) {
        return defaultSelection(id, TreeSelection.SelectionType.TOGGLE);
    }

    function rangeSelection(id: string) {
        return defaultSelection(id, TreeSelection.SelectionType.RANGE);
    }

    function expectState(state: TreeSelectionState | SelectableTreeNode[], expected: string[]) {
        const actual = (Array.isArray(state) ? state : state.asArray()).map(node => node.id);
        expect(actual).to.be.deep.equal(expected);
    }

});
