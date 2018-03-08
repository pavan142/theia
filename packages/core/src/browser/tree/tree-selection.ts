/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable, inject, postConstruct } from 'inversify';
import { Tree, TreeNode } from './tree';
import { PreOrderTreeIterator } from './tree-iterator';
import { Event, Emitter, Disposable, SelectionProvider } from '../../common';

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
     * Registers the given selection into the tree selection service. If the selection state changes after adding the
     * `selection` argument, a selection changed event will be fired.
     * If the `selection` argument is the `reset` string, then it will resets the selection state and remove all
     * previously selected items.
     */
    addSelection(selection: TreeSelection | 'reset'): void;

}

/**
 * Representation of a tree selection.
 */
export interface TreeSelection {

    /**
     * The actual item that has been selected.
     */
    readonly node: Readonly<SelectableTreeNode>;

    /**
     * The optional tree selection type. Defaults to `SelectionType.DEFAULT`;
     */
    readonly type?: TreeSelection.SelectionType;

}

export namespace TreeSelection {

    /**
     * Enumeration of selection types.
     */
    export enum SelectionType {

        /**
         * When selecting a tree node without any key masks.
         */
        DEFAULT,

        /**
         * When selecting a node with the `Ctrl`/`Cmd` key masking. The [`TOGGLE`](#TOGGLE) type takes precedence over the [`RANGE`](#RANGE).
         * In other words, if the actual key masking would comply both the `TOGGLE` and `RANGE`, then it will be treated as a `TOGGLE`.
         */
        TOGGLE,

        /**
         * When selecting a range of tree nodes with the `Shift` key mask.
         */
        RANGE

    }

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
    protected readonly onSelectionChangedEmitter = new Emitter<ReadonlyArray<Readonly<SelectableTreeNode>>>();

    protected state: TreeSelectionState;

    @postConstruct()
    protected init(): void {
        this.state = new TreeSelectionState(this.tree);
    }

    dispose() {
        this.onSelectionChangedEmitter.dispose();
    }

    get selectedNodes(): ReadonlyArray<Readonly<SelectableTreeNode>> {
        return this.state.asArray();
    }

    get onSelectionChanged(): Event<ReadonlyArray<Readonly<SelectableTreeNode>>> {
        return this.onSelectionChangedEmitter.event;
    }

    protected fireSelectionChanged(): void {
        this.onSelectionChangedEmitter.fire(this.state.asArray());
    }

    addSelection(selection: TreeSelection | 'reset'): void {
        if (typeof selection !== 'string' && this.validateNode(selection.node) === undefined) {
            return;
        }

        const oldState = this.state;
        const newState = this.state.nextState(selection);
        const oldNodes = oldState.asArray();
        const newNodes = newState.asArray();

        const toUnselect = this.difference(oldNodes, newNodes);
        const toSelect = this.difference(newNodes, oldNodes);
        if (toUnselect.length === 0 && toSelect.length === 0) {
            return;
        }

        this.unselect(toUnselect);
        this.select(toSelect);
        this.state = newState;
        this.fireSelectionChanged();
    }

    protected unselect(nodes: ReadonlyArray<SelectableTreeNode>): void {
        nodes.forEach(node => node.selected = false);
    }

    protected select(nodes: ReadonlyArray<SelectableTreeNode>): void {
        nodes.forEach(node => node.selected = true);
    }

    /**
     * Returns an array of the difference of two arrays. The returned array contains all elements that are contained by
     * `left` and not contained by `right`. `right` may also contain elements not present in `left`: these are simply ignored.
     */
    protected difference<T>(left: ReadonlyArray<T>, right: ReadonlyArray<T>): ReadonlyArray<T> {
        return left.filter(item => right.indexOf(item) === -1);
    }

    /**
     * Returns a reference to the argument if the node exists in the tree. Otherwise, `undefined`.
     */
    protected validateNode(node: Readonly<TreeNode>): Readonly<TreeNode> | undefined {
        return this.tree.validateNode(node);
    }

}

export class TreeSelectionState {

    constructor(protected tree: Tree, protected readonly selectionStack: ReadonlyArray<TreeSelection> = []) {
    }

    nextState(selection: TreeSelection | 'reset'): TreeSelectionState {
        if (typeof selection === 'string') {
            switch (selection) {
                case 'reset': return this.handleReset(this);
                default: throw new Error(`Unexpected tree selection: ${selection}.`);
            }
        }
        if (selection.type === undefined) {
            Object.assign(selection, {
                type: TreeSelection.SelectionType.DEFAULT
            });
        }
        const { node, type } = selection;
        switch (type) {
            case TreeSelection.SelectionType.DEFAULT: return this.handleDefault(this, node);
            case TreeSelection.SelectionType.TOGGLE: return this.handleToggle(this, node);
            case TreeSelection.SelectionType.RANGE: return this.handleRange(this, node);
            default: throw new Error(`Unexpected tree selection type: ${type}.`);
        }
    }

    asArray(): ReadonlyArray<SelectableTreeNode> {
        const copy = this.checkNoDefaultSelection(this.selectionStack);
        const nodes: SelectableTreeNode[] = [];
        let lastSelection: { node: SelectableTreeNode, type: TreeSelection.SelectionType | undefined } | undefined;
        for (let i = 0; i < copy.length; i++) {
            const { node, type } = copy[i];
            if (type === TreeSelection.SelectionType.RANGE) {
                if (lastSelection && lastSelection.type === TreeSelection.SelectionType.TOGGLE) {
                    // We pop the item we saved to be able to calculate the range. See #handleRange.
                    nodes.pop();
                }
                nodes.push(...this.selectionRange(lastSelection ? lastSelection.node : undefined, node));
            } else if (type === TreeSelection.SelectionType.TOGGLE) {
                nodes.push(node);
            }
            lastSelection = { node, type };
        }
        return nodes.reverse();
    }

    protected handleReset(state: TreeSelectionState): TreeSelectionState {
        return new TreeSelectionState(this.tree);
    }

    protected handleDefault(state: TreeSelectionState, selectedNode: Readonly<SelectableTreeNode>): TreeSelectionState {
        const { tree } = state;
        // Internally, We replace all `DEFAULT` types with toggle.
        return new TreeSelectionState(tree, [{
            node: selectedNode,
            type: TreeSelection.SelectionType.TOGGLE
        }]);
    }

    protected handleToggle(state: TreeSelectionState, selectedNode: Readonly<SelectableTreeNode>): TreeSelectionState {
        const { tree, selectionStack } = state;
        const copy = this.checkNoDefaultSelection(selectionStack).slice();

        // First, we check whether the toggle selection intersects any ranges.
        // This can happen only when removing an individual selection.
        // If so, we split the range selection into individual toggle selections.
        let lastSelection: SelectableTreeNode | undefined;
        for (let i = copy.length - 1; i >= 0; i--) {
            lastSelection = (copy[i - 1] || {}).node;
            const { node, type } = copy[i];
            if (type === TreeSelection.SelectionType.RANGE) {
                const range = this.selectionRange(lastSelection, node);
                const index = range.indexOf(selectedNode);
                if (index !== -1) {
                    range.splice(index, 1);
                    const rangeSubstitute = range.map(n => ({ node: n, type: TreeSelection.SelectionType.TOGGLE }));
                    // Remove the first item, that is the border. We do not want to include twice.
                    rangeSubstitute.shift();
                    copy.splice(i, 1, ...rangeSubstitute);
                    return new TreeSelectionState(tree, [...copy]);
                }
            }
        }

        const toggle = { node: selectedNode, type: TreeSelection.SelectionType.TOGGLE };
        const toRemove: number[] = [];
        for (let i = copy.length - 1; i >= 0; i--) {
            // We try to merge toggle selections. So that when a node has been selected twice with the toggle selection type, we remove both.
            // We do this until we see another range selection in the stack.
            const selection = copy[i];
            const { node, type } = selection;
            if (type === TreeSelection.SelectionType.RANGE) {
                break;
            }
            if (node === selectedNode) {
                toRemove.push(i);
            }
        }

        toRemove.forEach(index => copy.splice(index, 1));
        if (toRemove.length > 0) {
            // If we merged selections together, we can omit the current selection.
            return new TreeSelectionState(tree, [...copy]);
        } else {
            return new TreeSelectionState(tree, [...copy, toggle]);
        }
    }

    protected handleRange(state: TreeSelectionState, selectedNode: Readonly<SelectableTreeNode>): TreeSelectionState {
        const { tree, selectionStack } = state;
        const copy = this.checkNoDefaultSelection(selectionStack).slice();
        const range = { node: selectedNode, type: TreeSelection.SelectionType.RANGE };
        const lastSelection = (copy[copy.length - 1] || {}).node;
        const toRemove: number[] = [];
        for (let i = copy.length - 1; i >= 0; i--) {
            // We try to merge all the toggle selections into the range. So that when a range contains a toggle selection, we remove the toggle selection.
            // We do this until we see another range selection in the stack. Expect when the last selection was a range as well.
            // If the most recent selection was a range, we are just trying to modify that right now.
            const selection = copy[i];
            const { node, type } = selection;
            if (type === TreeSelection.SelectionType.RANGE) {
                // When trying to modify the most recent range selection.
                if (i === copy.length - 1) {
                    copy.pop();
                }
                break;
            }
            if (this.in(range, lastSelection, node)) {
                toRemove.push(i);
            }
        }
        // We never drop the very first item, otherwise we lose the range start information. A range selection must come after a toggle.
        toRemove.shift();
        toRemove.forEach(index => copy.splice(index, 1));
        return new TreeSelectionState(tree, [...copy, range]);
    }

    /**
     * `true` if the `toTest` tree node is contained in the selection range between the `from` and the `range.node`. Otherwise, `false`.
     */
    protected in(range: TreeSelection, from: Readonly<SelectableTreeNode> | undefined, toTest: Readonly<SelectableTreeNode>): boolean {
        if (range.type !== TreeSelection.SelectionType.RANGE) {
            throw new Error(`The argument 'range' must have a RANGE selection type. Was: ${JSON.stringify(range)}.`);
        }
        if (from === undefined) {
            return false;
        }
        const { root } = this.tree;
        if (root === undefined) {
            return false;
        }
        const to = range.node;
        if (from === toTest || to === toTest) {
            return true;
        }
        let started = false;
        let finished = false;
        for (const node of new PreOrderTreeIterator(root, { pruneCollapsed: true })) {
            if (finished || (toTest === node && !started)) {
                return false;
            }
            // Only collect items which are between (inclusive) the `from` node and the `to` node.
            if (node === from || node === to) {
                if (started) {
                    finished = true;
                } else {
                    started = true;
                }
            }
            if (started && toTest === node) {
                return true;
            }
        }
        return false;
    }

    /**
     * Returns with an array of items representing the selection range. Both the `fromNode` and the `toNode` are inclusive.
     */
    protected selectionRange(fromNode: Readonly<SelectableTreeNode> | undefined, toNode: Readonly<SelectableTreeNode>): Readonly<SelectableTreeNode>[] {
        if (fromNode === undefined) {
            return [];
        }
        if (toNode === fromNode) {
            return [];
        }
        const { root } = this.tree;
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

        // We need to reverse the selection range order.
        if (range.indexOf(from) > range.indexOf(to)) {
            range.reverse();
        }
        return range.filter(SelectableTreeNode.is);
    }

    /**
     * Checks whether the argument contains any `DEFAULT` tree selection type. If yes, throws an error, otherwise returns with a reference the argument.
     */
    protected checkNoDefaultSelection(selections: ReadonlyArray<TreeSelection>): ReadonlyArray<TreeSelection> {
        if (selections.some(selection => selection.type === undefined || selection.type === TreeSelection.SelectionType.DEFAULT)) {
            throw new Error(`Unexpected DEFAULT selection type. [${selections.map(selection => `ID: ${selection.node.id} | ${selection.type}`).join(', ')}]`);
        }
        return selections;
    }

}
