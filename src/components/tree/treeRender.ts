import { select, type Selection } from 'd3-selection';
import { hierarchy, tree as d3tree, type HierarchyPointNode } from 'd3-hierarchy';
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
import { interpolateHsl } from 'd3-interpolate';
import type { TreeNode } from './treeTypes';
import { plays, whiteAdvantage } from '../../lib/tree';

export interface RenderOpts {
  width: number;
  height: number;
  activePath: Set<string>;
  onNodeClick: (id: string, shiftKey: boolean) => void;
  onNodeHover: (id: string | null, fen: string | null, x: number, y: number) => void;
}

interface PointDatum extends HierarchyPointNode<TreeNode> {}

function nodeRadius(n: TreeNode): number {
  const p = plays(n);
  return Math.min(30, Math.max(5, Math.sqrt(p) / 8 + 5));
}

// Dark-theme palette: keep white-favorable warm and easy to spot,
// black-favorable as a deep slate, neutral as zinc-500.
const whiteWarm = '#fde68a'; // amber-200
const neutralZinc = '#52525b'; // zinc-600
const blackDark = '#18181b'; // zinc-900
const accent = '#fbbf24'; // amber-400
const edgeIdle = 'rgba(113, 113, 122, 0.6)'; // zinc-500/60
const edgeText = '#a1a1aa'; // zinc-400

const interpToWhite = interpolateHsl(neutralZinc, whiteWarm);
const interpToBlack = interpolateHsl(neutralZinc, blackDark);

function nodeFill(n: TreeNode): string {
  const adv = whiteAdvantage(n);
  if (adv === 0) return neutralZinc;
  return adv > 0
    ? (interpToWhite(Math.min(1, adv)) as string)
    : (interpToBlack(Math.min(1, -adv)) as string);
}

let zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> | null = null;

export function renderTree(svgEl: SVGSVGElement, data: TreeNode, opts: RenderOpts): void {
  const svg = select(svgEl);
  svg.selectAll('*').remove();

  // soft glow filter for active nodes/edges
  const defs = svg.append('defs');
  const filter = defs.append('filter').attr('id', 'glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
  filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur');
  const merge = filter.append('feMerge');
  merge.append('feMergeNode').attr('in', 'blur');
  merge.append('feMergeNode').attr('in', 'SourceGraphic');

  const g = svg.append('g').attr('class', 'pan');

  const root = hierarchy<TreeNode>(data, (n) => (n.expanded ? n.children : []));
  const layout = d3tree<TreeNode>().nodeSize([46, 200]);
  layout(root);

  const nodes = root.descendants() as PointDatum[];
  const links = root.links();

  // edges
  g.append('g')
    .attr('class', 'links')
    .selectAll<SVGPathElement, (typeof links)[number]>('path.tree-link')
    .data(links)
    .enter()
    .append('path')
    .attr('class', 'tree-link')
    .attr('fill', 'none')
    .attr('stroke', (d) =>
      opts.activePath.has((d.target as PointDatum).data.id) ? accent : edgeIdle,
    )
    .attr('stroke-opacity', (d) =>
      opts.activePath.has((d.target as PointDatum).data.id) ? 0.95 : 0.75,
    )
    .attr('stroke-width', (d) => {
      const target = (d.target as PointDatum).data;
      const parent = (d.source as PointDatum).data;
      const tp = plays(target);
      const pp = plays(parent) || 1;
      const isActive = opts.activePath.has(target.id);
      const w = Math.max(1, Math.min(7, (tp / pp) * 7));
      return isActive ? Math.max(w, 3.5) : w;
    })
    .attr('d', (d) => {
      const s = d.source as PointDatum;
      const t = d.target as PointDatum;
      const mx = (s.y + t.y) / 2;
      return `M${s.y},${s.x} C${mx},${s.x} ${mx},${t.x} ${t.y},${t.x}`;
    });

  // edge labels with halo
  g.append('g')
    .attr('class', 'edge-labels')
    .selectAll('text.tree-edge-label')
    .data(links)
    .enter()
    .append('text')
    .attr('class', 'tree-edge-label')
    .attr('font-size', 11)
    .attr('font-family', "'JetBrains Mono', ui-monospace, monospace")
    .attr('fill', (d) =>
      opts.activePath.has((d.target as PointDatum).data.id) ? accent : edgeText,
    )
    .attr('x', (d) => {
      const s = d.source as PointDatum;
      const t = d.target as PointDatum;
      return s.y * 0.25 + t.y * 0.75;
    })
    .attr('y', (d) => {
      const s = d.source as PointDatum;
      const t = d.target as PointDatum;
      return s.x * 0.25 + t.x * 0.75 - 6;
    })
    .attr('text-anchor', 'middle')
    .style('paint-order', 'stroke')
    .style('stroke', '#0a0a0c')
    .style('stroke-width', 3)
    .text((d) => (d.target as PointDatum).data.san ?? '');

  // nodes
  const nodeG = g
    .append('g')
    .attr('class', 'nodes')
    .selectAll<SVGGElement, PointDatum>('g.tree-node')
    .data(nodes)
    .enter()
    .append('g')
    .attr('class', (d) => 'tree-node' + (opts.activePath.has(d.data.id) ? ' active' : ''))
    .attr('transform', (d) => `translate(${d.y},${d.x})`)
    .style('cursor', 'pointer')
    .on('click', function (event: MouseEvent, d) {
      event.stopPropagation();
      opts.onNodeClick(d.data.id, event.shiftKey);
    })
    .on('mouseenter', function (event: MouseEvent, d) {
      opts.onNodeHover(d.data.id, d.data.id, event.clientX, event.clientY);
    })
    .on('mousemove', function (event: MouseEvent, d) {
      opts.onNodeHover(d.data.id, d.data.id, event.clientX, event.clientY);
    })
    .on('mouseleave', function () {
      opts.onNodeHover(null, null, 0, 0);
    });

  nodeG
    .append('circle')
    .attr('r', (d) => nodeRadius(d.data))
    .attr('fill', (d) => nodeFill(d.data))
    .attr('stroke', (d) => (opts.activePath.has(d.data.id) ? accent : 'rgba(161,161,170,0.6)'))
    .attr('stroke-width', (d) => (opts.activePath.has(d.data.id) ? 2.5 : 1));

  // animated pulse for loading nodes
  nodeG
    .filter((d) => !!d.data.loading)
    .append('circle')
    .attr('class', 'pulse-ring')
    .attr('r', (d) => nodeRadius(d.data))
    .attr('fill', 'none')
    .attr('stroke', accent)
    .attr('stroke-width', 2);

  // expand marker on collapsed nodes with plays
  nodeG
    .filter((d) => !d.data.expanded && plays(d.data) > 0)
    .append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .attr('font-size', 10)
    .attr('font-weight', 600)
    .attr('fill', (d) =>
      whiteAdvantage(d.data) > 0.2 ? '#27272a' : '#e4e4e7',
    )
    .text('+');

  // pan / zoom
  zoomBehavior = zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.3, 4])
    .on('zoom', (ev) => g.attr('transform', ev.transform.toString()));
  (svg as Selection<SVGSVGElement, unknown, null, undefined>).call(zoomBehavior);

  const initial = zoomIdentity.translate(80, opts.height / 2);
  (svg as Selection<SVGSVGElement, unknown, null, undefined>).call(zoomBehavior.transform, initial);
}
