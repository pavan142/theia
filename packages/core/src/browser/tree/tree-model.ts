/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { inject, injectable, postConstruct } from 'inversify';
import { DisposableCollection, Event, Emitter, SelectionProvider } from '../../common';
import { Tree, TreeNode, CompositeTreeNode } from './tree';
import { TreeSelectionService, SelectableTreeNode } from './tree-selection';
import { TreeExpansionService, ExpandableTreeNode } from './tree-expansion';
import { TreeNavigationService } from './tree-navigation';
import { TreeIterator, PreOrderTreeIterator, BottomToTopTreeIterator, TopToBottomTreeIterator } from './tree-iterator';

/**
 * The tree model.
 */
export const TreeModel = Symbol('TreeModel');
export interface TreeModel extends Tree, TreeSelectionService, TreeExpansionService {

    /**
     * Expands the given node. If the `node` argument is `undefined`, then expands the currently selected tree node.
     * If multiple tree nodes are selected, expands the most recently selected tree node.
     */
    expandNode(node?: Readonly<ExpandableTreeNode>): boolean;

    /**
     * Collapses the given node. If the `node` argument is `undefined`, then collapses the currently selected tree node.
     * If multiple tree nodes are selected, collapses the most recently selected tree node.
     */
    collapseNode(node?: Readonly<ExpandableTreeNode>): boolean;

    /**
     * Toggles the expansion state of the given node. If not give, then it toggles the expansion state of the currently selected node.
     * If multiple nodes are selected, then the most recently selected tree node's expansion state will be toggled.
     */
    toggleNodeExpansion(node?: Readonly<ExpandableTreeNode>): void;

    /**
     * Opens the given node or the currently selected on if the argument is `undefined`.
     * If multiple nodes are selected, open the most recently selected node.
     */
    openNode(node?: Readonly<TreeNode> | undefined): void;

    /**
     * Event when a node should be opened.
     */
    readonly onOpenNode: Event<Readonly<TreeNode>>;

    /**
     * Selects the parent node relatively to the selected taking into account node expansion.
     */
    selectParent(): void;

    /**
     * Navigates to the given node if it is defined.
     * Navigation sets a node as a root node and expand it.
     */
    navigateTo(node: Readonly<TreeNode> | undefined): void;

    /**
     * Tests whether it is possible to navigate forward.
     */
    canNavigateForward(): boolean;

    /**
     * Tests whether it is possible to navigate backward.
     */
    canNavigateBackward(): boolean;

    /**
     * Navigates forward.
     */
    navigateForward(): void;

    /**
     * Navigates backward.
     */
    navigateBackward(): void;

    /**
     * Selects the previous node relatively to the currently selected one. This method takes the expansion state of the tree into consideration.
     */
    selectPrevNode(preserveSelection?: boolean): void;

    /**
     * Selects the next node relatively to the currently selected one. This method takes the expansion state of the tree into consideration.
     */
    selectNextNode(preserveSelection?: boolean): void;

    /**
     * Selects the tree node argument.
     *
     *  - If the `preserveSelection` argument is `false` or `undefined`, then it has the same effect as invoking `setSelection([node])`. The previous selection
     * state will be overridden with given single tree node.
     *  - If `preserveSelection` is `true`, then the previous selection state will be kept and the `node` argument will be merged into the previous selection state.
     *  - If `preserveSelection` is `true` and the `node` was already selected, the selection content will not change but the order of the selected items. The
     * `node` argument will be the most recently selected item.
     */
    selectNode(node: Readonly<SelectableTreeNode>, preserveSelection?: boolean): void;

    /**
     * Unselects the given tree node argument. Has no effect, if the argument is not a valid tree node, or was not yet selected.
     */
    unselectNode(node: Readonly<SelectableTreeNode>): void;

    /**
     * Toggles the selection state of the `node` argument. If the node was not yet selected, it will be. Toggling the state of the tree node
     * will keep any previous selection state. If the `node` was selected, `unselects` the node.
     */
    toggleSelection(node: Readonly<SelectableTreeNode>): void;

    /**
     * Returns with the nodes between (inclusive) the `toNode` and the `fromNode`. Returns with an empty array if either the `toNode` or the `fromNode` is invalid.
     */
    selectionRange(toNode: Readonly<SelectableTreeNode>, fromNode: Readonly<SelectableTreeNode>): ReadonlyArray<Readonly<SelectableTreeNode>>;

    /**
     * Calculates and sets the selection range between the `fromNode` and the `toNode`.
     *  - Has not effect if either the `fromNode` or the `toNode` does not exist or invalid.
     *  - If `preserveSelection` is `true`, then the range of selection will be merged into the previous selection state.
     *  - If `preserveSelection` is `false` or `undefined`, then the previous state will be overridden with the selection range.
     *  - If `fromNode` is `undefined`, then the most recently selected tree node will be used instead.
     */
    selectRange(toNode: Readonly<SelectableTreeNode>, fromNode?: Readonly<SelectableTreeNode>, preserveSelection?: boolean): void;

}

@injectable()
export class TreeModelImpl implements TreeModel, SelectionProvider<ReadonlyArray<Readonly<SelectableTreeNode>>> {

    @inject(Tree) protected readonly tree: Tree;
    @inject(TreeSelectionService) protected readonly selectionService: TreeSelectionService;
    @inject(TreeExpansionService) protected readonly expansionService: TreeExpansionService;
    @inject(TreeNavigationService) protected readonly navigationService: TreeNavigationService;

    protected readonly onChangedEmitter = new Emitter<void>();
    protected readonly onOpenNodeEmitter = new Emitter<TreeNode>();
    protected readonly toDispose = new DisposableCollection();

    @postConstruct()
    protected init(): void {
        this.toDispose.push(this.tree);
        this.toDispose.push(this.tree.onChanged(() => this.fireChanged()));

        this.toDispose.push(this.selectionService);
        this.toDispose.push(this.selectionService.onSelectionChanged(() => this.fireChanged()));

        this.toDispose.push(this.expansionService);
        this.toDispose.push(this.expansionService.onExpansionChanged(node => {
            this.fireChanged();
            if (!node.expanded && [...this.selectedNodes].some(selectedNode => CompositeTreeNode.isAncestor(node, selectedNode))) {
                if (SelectableTreeNode.isVisible(node)) {
                    this.setSelection([node]);
                }
            }
        }));

        this.toDispose.push(this.onOpenNodeEmitter);
        this.toDispose.push(this.onChangedEmitter);
    }

    dispose() {
        this.toDispose.dispose();
    }

    get root() {
        return this.tree.root;
    }

    set root(root: TreeNode | undefined) {
        this.tree.root = root;
    }

    get onChanged(): Event<void> {
        return this.onChangedEmitter.event;
    }

    get onOpenNode(): Event<TreeNode> {
        return this.onOpenNodeEmitter.event;
    }

    protected fireChanged(): void {
        this.onChangedEmitter.fire(undefined);
    }

    get onNodeRefreshed() {
        return this.tree.onNodeRefreshed;
    }

    getNode(id: string | undefined) {
        return this.tree.getNode(id);
    }

    validateNode(node: TreeNode | undefined) {
        return this.tree.validateNode(node);
    }

    refresh(parent?: Readonly<CompositeTreeNode>): void {
        if (parent) {
            this.tree.refresh(parent);
        } else {
            this.tree.refresh();
        }
    }

    get selectedNodes() {
        return this.selectionService.selectedNodes;
    }

    get onSelectionChanged() {
        return this.selectionService.onSelectionChanged;
    }

    setSelection(raw: ReadonlyArray<Readonly<SelectableTreeNode>>): void {
        this.selectionService.setSelection(raw);
    }

    get onExpansionChanged() {
        return this.expansionService.onExpansionChanged;
    }

    expandNode(raw?: Readonly<ExpandableTreeNode>): boolean {
        for (const node of raw ? [raw] : this.selectedNodes) {
            if (ExpandableTreeNode.is(node)) {
                return this.expansionService.expandNode(node);
            }
        }
        return false;
    }

    collapseNode(raw?: Readonly<ExpandableTreeNode>): boolean {
        for (const node of raw ? [raw] : this.selectedNodes) {
            if (ExpandableTreeNode.is(node)) {
                return this.expansionService.collapseNode(node);
            }
        }
        return false;
    }

    toggleNodeExpansion(raw?: Readonly<ExpandableTreeNode>): void {
        for (const node of raw ? [raw] : this.selectedNodes) {
            if (ExpandableTreeNode.is(node)) {
                return this.expansionService.toggleNodeExpansion(node);
            }
        }
    }

    selectPrevNode(preserveSelection?: boolean): void {
        const node = this.selectedNodes[0];
        const iterator = this.createBackwardIterator(node);
        if (iterator) {
            this.selectNextVisibleNode(iterator, preserveSelection);
        }
    }

    selectNextNode(preserveSelection?: boolean): void {
        const node = this.selectedNodes[0];
        const iterator = this.createIterator(node);
        if (iterator) {
            this.selectNextVisibleNode(iterator, preserveSelection);
        }
    }

    protected selectNextVisibleNode(iterator: TreeIterator, preserveSelection?: boolean): void {
        // Skip the first item. // TODO: clean this up, and skip the first item in a different way without loading everything.
        iterator.next();
        let result = iterator.next();
        while (!result.done && !SelectableTreeNode.isVisible(result.value)) {
            result = iterator.next();
        }
        const node = result.value;
        if (SelectableTreeNode.isVisible(node)) {
            this.selectNode(node, preserveSelection);
        }
    }

    protected createBackwardIterator(node: TreeNode | undefined): TreeIterator | undefined {
        return node ? new BottomToTopTreeIterator(node!, { pruneCollapsed: true }) : undefined;
    }

    protected createIterator(node: TreeNode | undefined): TreeIterator | undefined {
        return node ? new TopToBottomTreeIterator(node!, { pruneCollapsed: true }) : undefined;
    }

    openNode(raw?: TreeNode | undefined): void {
        const node = raw || this.selectedNodes[0];
        if (node) {
            this.doOpenNode(node);
            this.onOpenNodeEmitter.fire(node);
        }
    }

    protected doOpenNode(node: TreeNode): void {
        if (ExpandableTreeNode.is(node)) {
            this.toggleNodeExpansion(node);
        }
    }

    selectParent(): void {
        if (this.selectedNodes.length === 1) {
            const node = this.selectedNodes[0];
            const parent = SelectableTreeNode.getVisibleParent(node);
            if (parent) {
                this.setSelection([parent]);
            }
        }
    }

    navigateTo(node: TreeNode | undefined): void {
        if (node) {
            this.navigationService.push(node);
            this.doNavigate(node);
        }
    }

    canNavigateForward(): boolean {
        return !!this.navigationService.next;
    }

    canNavigateBackward(): boolean {
        return !!this.navigationService.prev;
    }

    navigateForward(): void {
        const node = this.navigationService.advance();
        if (node) {
            this.doNavigate(node);
        }
    }

    navigateBackward(): void {
        const node = this.navigationService.retreat();
        if (node) {
            this.doNavigate(node);
        }
    }

    protected doNavigate(node: TreeNode): void {
        this.tree.root = node;
        if (ExpandableTreeNode.is(node)) {
            this.expandNode(node);
        }
        if (SelectableTreeNode.is(node)) {
            this.setSelection([node]);
        }
    }

    selectNode(node: Readonly<SelectableTreeNode>, preserveSelection?: boolean): void {
        if (!!preserveSelection) {
            const copy = this.selectedNodes.slice();
            const index = copy.indexOf(node);
            if (index === -1) {
                this.selectionService.setSelection([node, ...copy]);
            } else {
                // No need to update the selection if the argument is already the most recently selected node at the 0th index.
                if (index !== 0) {
                    copy.splice(index, 1);
                    copy.unshift(node);
                    this.selectionService.setSelection(copy);
                }
            }
        } else {
            this.selectionService.setSelection([node]);
        }
    }

    unselectNode(node: Readonly<SelectableTreeNode>): void {
        const copy = this.selectedNodes.slice();
        const index = copy.indexOf(node);
        if (index !== -1) {
            copy.splice(index, 1);
            this.selectionService.setSelection(copy);
        }
    }

    toggleSelection(node: Readonly<SelectableTreeNode>): void {
        if (node.selected) {
            this.unselectNode(node);
        } else {
            this.selectNode(node, true);
        }
    }

    selectionRange(toNode: Readonly<SelectableTreeNode>, fromNode: Readonly<SelectableTreeNode>): ReadonlyArray<Readonly<SelectableTreeNode>> {
        if (toNode === fromNode) {
            return [];
        }
        const { root } = this;
        if (root === undefined) {
            return [];
        }
        const to = this.tree.validateNode(toNode);
        if (to === undefined) {
            return [];
        }
        const from = this.tree.validateNode(fromNode);
        if (from === undefined) {
            return [];
        }

        let started = false;
        let finished = false;
        const range: TreeNode[] = [];
        for (const node of new PreOrderTreeIterator(root, { pruneCollapsed: true })) {
            if (finished) {
                break;
            }
            // Only collect items which are between (inclusive) the `from` node and the `to` node.
            if (node === from || node === to) {
                if (started) {
                    finished = true;
                } else {
                    started = true;
                }
            }
            if (started) {
                range.push(node);
            }
        }

        // We need to reverse the range order.
        if (range.indexOf(from) > range.indexOf(to)) {
            range.reverse();
        }
        return range.filter(SelectableTreeNode.is).slice();
    }

    selectRange(toNode: Readonly<SelectableTreeNode>, fromNode?: Readonly<SelectableTreeNode>, preserveSelection?: boolean): void {
        const range = this.selectionRange(toNode, fromNode ? fromNode : this.selectedNodes[0]).slice().reverse();
        if (range.length === 0) {
            return;
        }
        if (!!preserveSelection) {
            const copy = this.selectedNodes.slice();
            for (const node of copy) {
                const index = range.indexOf(node);
                if (index !== -1) {
                    copy.splice(index, 1);
                }
            }
            this.setSelection([...range, ...copy]);
        } else {
            this.setSelection(range);
        }
    }

}
