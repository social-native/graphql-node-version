import {INodeBuilderNodeChangeVersionInfo, INodeBuilderFragmentNodes} from 'types';

export const computeNodeFromNodeChange = <Node extends any>(
    previousNode: Node,
    versionInfo: INodeBuilderNodeChangeVersionInfo
): Node => {
    const {revisionData} = versionInfo;
    let data;
    try {
        data = JSON.parse(revisionData) as object;
    } catch {
        data = undefined;
    }
    return {
        ...previousNode,
        ...data
    };
};

export const computeNodeFromNodeChangeFragment = <
    Node extends any,
    FragmentNode extends {[key: string]: any}
>(
    previousNode: Node,
    fragmentNodes: INodeBuilderFragmentNodes<FragmentNode>,
    computeNodeWithFragmentsFn: (previousNode: Node, fragmentNodes: FragmentNode[]) => Node
): Node => {
    const fragmentsByName = Object.keys(fragmentNodes).map((n: any) => fragmentNodes[n]);
    const fragmentNodesById = fragmentsByName.reduce(
        (acc, f) => {
            const nodes = Object.keys(f).map((n: any) => f[n]);
            acc = [...acc, ...nodes];
            return acc;
        },
        [] as FragmentNode[]
    );
    return computeNodeWithFragmentsFn(previousNode, fragmentNodesById);
};
