/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable, inject } from 'inversify';
import { Tree, TreeNode } from './tree';
import { Event, Emitter, Disposable, SelectionProvider, notEmpty } from '../../common';

/**
 * The tree selection service.
 */
export const TreeSelectionService = Symbol("TreeSelectionService");
export interface TreeSelectionService extends Disposable, SelectionProvider<ReadonlyArray<Readonly<SelectableTreeNode>>> {

    /**
     * The tree selection, representing the selected nodes from the tree. If nothing is selected, the
     * result will be empty.
     */
    readonly selectedNodes: ReadonlyArray<Readonly<SelectableTreeNode>>;

    /**
     * Emitted when the selection has changed in the tree.
     */
    readonly onSelectionChanged: Event<ReadonlyArray<Readonly<SelectableTreeNode>>>;

    /**
     * Sets the selection state by unselecting all the currently selected items, and selecting all
     * the valid, existing tree nodes from the argument.
     */
    setSelection(nodes: ReadonlyArray<Readonly<SelectableTreeNode>>): void;

}

/**
 * A selectable tree node.
 */
export interface SelectableTreeNode extends TreeNode {

    /**
     * `true` if the tree node is selected. Otherwise, `false`.
     */
    selected: boolean;

}

export namespace SelectableTreeNode {

    export function is(node: TreeNode | undefined): node is SelectableTreeNode {
        return !!node && 'selected' in node;
    }

    export function isSelected(node: TreeNode | undefined): node is SelectableTreeNode {
        return is(node) && node.selected;
    }

    export function isVisible(node: TreeNode | undefined): node is SelectableTreeNode {
        return is(node) && TreeNode.isVisible(node);
    }

    export function getVisibleParent(node: TreeNode | undefined): SelectableTreeNode | undefined {
        if (node) {
            if (isVisible(node.parent)) {
                return node.parent;
            }
            return getVisibleParent(node.parent);
        }
    }
}

@injectable()
export class TreeSelectionServiceImpl implements TreeSelectionService {

    @inject(Tree)
    protected readonly tree: Tree;
    protected readonly _selectedNodes: SelectableTreeNode[] = [];
    protected readonly onSelectionChangedEmitter = new Emitter<ReadonlyArray<Readonly<SelectableTreeNode>>>();

    dispose() {
        this.onSelectionChangedEmitter.dispose();
    }

    get selectedNodes(): ReadonlyArray<Readonly<SelectableTreeNode>> {
        return this._selectedNodes.slice();
    }

    get onSelectionChanged(): Event<ReadonlyArray<Readonly<SelectableTreeNode>>> {
        return this.onSelectionChangedEmitter.event;
    }

    protected fireSelectionChanged(): void {
        this.onSelectionChangedEmitter.fire(this._selectedNodes.slice());
    }

    setSelection(nodes: ReadonlyArray<Readonly<SelectableTreeNode>>): void {
        this.doSelectNodes(nodes.slice().filter(this.validateNode.bind(this)).filter(notEmpty).filter(SelectableTreeNode.is));
    }

    protected doSelectNodes(nodes: SelectableTreeNode[]): void {
        const copy = nodes.slice();
        this._selectedNodes.forEach(node => node.selected = false);
        this._selectedNodes.length = 0;
        copy.forEach(node => node.selected = true);
        this._selectedNodes.push(...copy);
        this.fireSelectionChanged();
    }

    protected validateNode(node: Readonly<TreeNode> | undefined): Readonly<TreeNode> | undefined {
        return this.tree.validateNode(node);
    }

}
