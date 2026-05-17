import { useEffect, useRef, useState } from 'react';
import { renderTree } from './treeRender';
import { NodePreview } from './NodePreview';
import type { TreeNode } from './treeTypes';

interface Props {
  data: TreeNode;
  activePath: Set<string>;
  onNodeClick: (id: string, shiftKey: boolean) => void;
}

export function OpeningTree({ data, activePath, onNodeClick }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<{ fen: string; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!svgRef.current || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    renderTree(svgRef.current, data, {
      width: rect.width,
      height: rect.height,
      activePath,
      onNodeClick,
      onNodeHover: (id, fen, x, y) => {
        if (id && fen) setHover({ fen, x, y });
        else setHover(null);
      },
    });
  }, [data, activePath, onNodeClick]);

  return (
    <div ref={wrapRef} className="relative w-full h-full overflow-hidden">
      <svg ref={svgRef} className="w-full h-full block" />
      {hover && <NodePreview fen={hover.fen} x={hover.x} y={hover.y} />}
    </div>
  );
}
