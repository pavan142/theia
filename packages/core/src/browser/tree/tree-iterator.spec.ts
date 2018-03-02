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
import { PreOrderTreeIterator, BreadthFirstTreeIterator, BottomToTopTreeIterator, TopToBottomTreeIterator } from './tree-iterator';

disableJSDOM();

// tslint:disable:no-unused-expression
// tslint:disable:max-line-length

describe('tree-iterator', () => {

    const model: TreeModel = createTreeContainer(new Container({ defaultScope: 'Singleton' })).get(TreeModel);
    const findNode = (id: string) => model.getNode(id);

    beforeEach(() => {
        model.root = MOCK_ROOT();
    });

    it('should include root', () => {
        const expected = ['1'];
        const actual = [...new BottomToTopTreeIterator(findNode('1')!)].map(node => node.id);
        expect(expected).to.be.deep.equal(actual);
    });

    it('should return `undefined` after consuming the iterator', () => {
        const itr = new BottomToTopTreeIterator(findNode('1')!);
        let next = itr.next();
        while (!next.done) {
            expect(next.value).to.be.not.undefined;
            next = itr.next();
        }
        expect(next.done).to.be.true;
        expect(next.value).to.be.undefined;
    });

    it('pre-order (no collapsed nodes)', () => {
        const expected = ['1', '1.1', '1.1.1', '1.1.2', '1.2', '1.2.1', '1.2.1.1', '1.2.1.2', '1.2.2', '1.2.3', '1.3'];
        const actual = [...new PreOrderTreeIterator(model.root!)].map(node => node.id);
        expect(expected).to.be.deep.equal(actual);
    });

    it('pre-order (with collapsed nodes)', () => {
        collapseNode('1.1', '1.2.1');
        const expected = ['1', '1.1', '1.2', '1.2.1', '1.2.2', '1.2.3', '1.3'];
        const actual = [...new PreOrderTreeIterator(model.root!, { pruneCollapsed: true })].map(node => node.id);
        expect(expected).to.be.deep.equal(actual);
    });

    it('breadth-first (no collapsed nodes)', () => {
        const expected = ['1', '1.1', '1.2', '1.3', '1.1.1', '1.1.2', '1.2.1', '1.2.2', '1.2.3', '1.2.1.1', '1.2.1.2'];
        const actual = [...new BreadthFirstTreeIterator(model.root!)].map(node => node.id);
        expect(expected).to.be.deep.equal(actual);
    });

    it('breadth-first (with collapsed nodes)', () => {
        collapseNode('1.1', '1.2.1');
        const expected = ['1', '1.1', '1.2', '1.3', '1.2.1', '1.2.2', '1.2.3'];
        const actual = [...new BreadthFirstTreeIterator(model.root!, { pruneCollapsed: true })].map(node => node.id);
        expect(expected).to.be.deep.equal(actual);
    });

    it('bottom-to-top (no collapsed nodes)', () => {
        const expected = ['1.2.2', '1.2.1.2', '1.2.1.1', '1.2.1', '1.2', '1.1.2', '1.1.1', '1.1', '1'];
        const actual = [...new BottomToTopTreeIterator(findNode('1.2.2')!)].map(node => node.id);
        expect(expected).to.be.deep.equal(actual);
    });

    it('bottom-to-top (with collapsed nodes)', () => {
        collapseNode('1.1', '1.2.1');
        const expected = ['1.2.2', '1.2.1', '1.2', '1.1', '1'];
        const actual = [...new BottomToTopTreeIterator(findNode('1.2.2')!, { pruneCollapsed: true })].map(node => node.id);
        expect(expected).to.be.deep.equal(actual);
    });

    it('top-to-bottom (no collapsed nodes)', () => {
        const expected = ['1.1.2', '1.2', '1.2.1', '1.2.1.1', '1.2.1.2', '1.2.2', '1.2.3', '1.3'];
        const actual = [...new TopToBottomTreeIterator(findNode('1.1.2')!)].map(node => node.id);
        expect(expected).to.be.deep.equal(actual);
    });

    it('top-to-bottom (with collapsed nodes)', () => {
        collapseNode('1.2.1');
        const expected = ['1.1.2', '1.2', '1.2.1', '1.2.2', '1.2.3', '1.3'];
        const actual = [...new TopToBottomTreeIterator(findNode('1.1.2')!, { pruneCollapsed: true })].map(node => node.id);
        expect(expected).to.be.deep.equal(actual);
    });

    function collapseNode(...ids: string[]): void {
        ids.map(findNode).filter(notEmpty).filter(ExpandableTreeNode.is).forEach(node => {
            model.collapseNode(node);
            expect(node).to.have.property('expanded', false);
        });
    }

});
