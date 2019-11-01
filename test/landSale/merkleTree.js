/* eslint-disable class-methods-use-this, camelcase */

const Web3 = require('web3');

// console.log(Web3.utils.soliditySha3({
//     type: 'bytes32',
//     value: '0xc79af0aec7e5798c71f0f299a546aa54603d1bf9f55f12b39bfd163937c7a178',
// }, {
//     type: 'bytes32',
//     value: '0xc79af0aec7e5798c71f0f299a546aa54603d1bf9f55f12b39bfd163937c7a178',
// }));

class MerkleTree {
    constructor(data) {
        this.leavesByHash = {};
        this.leaves = this.buildLeaves(data);
        for (const leaf of this.leaves) {
            this.leavesByHash[leaf.hash] = leaf;
            console.log(leaf.hash);
        }
        this.root = this.computeMerkleTree(this.leaves);
    }

    /**
     * @description modify the array in place to ensure even numbers by duplicating last element if necessary
     * @param {array} elements An array
     * @returns {array} A new array
     */
    makeEvenElements(elements) {
        if (elements.length === 0) {
            throw new Error('No data was provided...');
        }

        const even = elements;

        if (even.length % 2 !== 0) {
            even.push(
                even[even.length - 1],
            );
            console.log('pushing same');
        }

        return even;
    }

    /**
     * @description Sorts an array (ascending order)
     * @param {array} arrayToSort The array to sort
     * @returns {array} The sorted array
     */
    sort(arrayToSort) {
        const sortedArray = [...arrayToSort];
        return sortedArray.sort((a, b) => Web3.utils.toBN(a.hash).gt(Web3.utils.toBN(b.hash)) ? 1 : -1);
    }

    /**
     * @description Builds the leaves of a Merkle tree
     * @param {array} data An array of data
     * @returns {array} The leaves of the Merkle tree (as an even and sorted array)
     */
    buildLeaves(data) {
        const leaves = this.makeEvenElements(data).map((leaf) => {
            return {hash: leaf};
        });
        return this.sort(leaves);
    }

    /**
     * @description Calculates a new node from 2 values
     * @param {string} left The left parameter for the new node
     * @param {string} right The right parameter for the new node
     * @returns {string} The new node (hash)
     */
    calculateParentNode(left, right) {
        let hash;
        // If a node doesn't have a sibling, it will be hashed with itself
        if (left === undefined || right === undefined) {
            hash = Web3.utils.soliditySha3({
                type: 'bytes32',
                value: right ? right.hash : left.hash,
            }, {
                type: 'bytes32',
                value: right ? right.hash : left.hash,
            });
        } else {
            hash = Web3.utils.soliditySha3({
                type: 'bytes32',
                value: left.hash
            }, {
                type: 'bytes32',
                value: right.hash,
            });
        }

        const parent = {
            hash,
            left,
            right
        };
        if (left) {
            left.parent = parent;
        }
        if (right) {
            right.parent = parent;
        }
        return parent;
    }

    /**
     * @description Calculates the parent nodes from an array of nodes
     * @param {array} nodes The current nodes
     * @returns {array} The parent nodes
     */
    createParentNodes(nodes) {
        const parentsNodes = [];

        for (let i = 0; i < nodes.length; i += 2) {
            if (!nodes[i] && !nodes[i + 1]) {
                throw new Error('both undefined');
            }
            const node = this.calculateParentNode(nodes[i], nodes[i + 1]);
            parentsNodes.push(node);
        }

        return parentsNodes;
    }

    /**
     * @description Computes a merkle tree
     * @param {array} leaves The initial leaves of the tree
     * @returns {object} A merkle tree
     */
    computeMerkleTree(leaves) {
        let nodes = leaves;

        while (nodes.length > 1) {
            nodes = this.createParentNodes(nodes);
            try {
                nodes = this.sort(nodes);
            } catch (e) {
                console.log('sortedArray', JSON.stringify(nodes, ['hash'], '  '));
            }
        }

        return nodes[0];
    }

    /**
     * @description Returns the leaves of the merkle tree
     * @returns {array} The leaves as an array
     */
    getLeaves() {
        return this.leaves;
    }

    /**
     * @description Returns the root of the merkle tree
     * @returns {string} The root as an string (hash)
     */
    getRoot() {
        return this.root;
    }

    /**
     * @description Returns the proof of a specific leaf
     * @param {string} leafHash The data to be proven
     * @returns {array} The array of proofs for the leaf
     */
    getProof(leafHash) {
        let leaf = this.leavesByHash[leafHash];

        console.log('leaf hash', leaf.hash);
        const path = [];
        while (leaf.parent) {
            if (leaf.parent.left === leaf) {
                console.log('take right of', leaf.parent.hash);
                path.push(leaf.parent.right ? leaf.parent.right.hash : leaf.parent.left.hash);
            } else {
                console.log('take left of', leaf.parent.hash);
                path.push(leaf.parent.left ? leaf.parent.left.hash : leaf.parent.right.hash);
            }
            leaf = leaf.parent;
        }

        return path;
    }

    isDataValid(data, proof) {
        const leaf = data; //Web3.utils.soliditySha3(data);

        let potentialRoot = leaf;

        for (let i = 0; i < proof.length; i += 1) {
            if (Web3.utils.toBN(potentialRoot).lt(Web3.utils.toBN(proof[i]))) {
                console.log(potentialRoot, '<', proof[i]);
                potentialRoot = Web3.utils.soliditySha3({
                    type: 'bytes32',
                    value: potentialRoot,
                }, {
                    type: 'bytes32',
                    value: proof[i],
                });
                console.log('potentialRoot using proof as right', potentialRoot);
            } else {
                console.log(potentialRoot, '>=', proof[i]);
                potentialRoot = Web3.utils.soliditySha3({
                    type: 'bytes32',
                    value: proof[i],
                }, {
                    type: 'bytes32',
                    value: potentialRoot,
                });
                console.log('potentialRoot using proof as left', potentialRoot);
            }
        }

        return this.getRoot().hash === potentialRoot;
    }
}

module.exports = MerkleTree;
