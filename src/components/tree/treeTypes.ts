export interface TreeNode {
  id: string;
  san?: string;
  white: number;
  draws: number;
  black: number;
  children: TreeNode[];
  expanded: boolean;
  loading?: boolean;
  depth: number;
}

export interface TreeBuildOpts {
  minShare: number;
  maxDepth: number;
}
