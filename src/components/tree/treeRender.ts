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
  // sqrt scale gives strong visual contrast: ! moves dominate, ? moves shrink.
  return Math.min(30, Math.max(5, Math.sqrt(p) / 8 + 5));
}

const whiteWarm = '#f4e4bc';
const neutralGray = '#cfcfcf';
const blackDark = '#3a3a3a';
const interpToWhite = interpolateHsl(neutralGray, whiteWarm);
const interpToBlack = interpolateHsl(neutralGray, blackDark);

function nodeFill(n: TreeNode): string {
  const adv = whiteAdvantage(n);
  if (adv === 0) return neutralGray;
  return adv > 0 ? interpToWhite(Math.min(1, adv)) : interpToBlack(Math.min(1, -adv));
}

let zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> | null = null;

export function renderTree(svgEl: SVGSVGElement, data: TreeNode, opts: RenderOpts): void {
  const svg = select(svgEl);
  svg.selectAll('*').remove();

  // root layer for pan/zoom
  const g = svg.append('g').attr('class', 'pan');

  const root = hierarchy<TreeNode>(data, (n) => (n.expanded ? n.children : []));

  const layout = d3tree<TreeNode>().nodeSize([42, 180]);
  layout(root);

  const nodes = root.descendants() as PointDatum[];
  const links = root.links();

  // edges
  g.append('g')
    .attr('class', 'links')
    .selectAll<SVGPathElement, (typeof links)[number]>('path.link')
    .data(links)
    .enter()
    .append('path')
    .attr('class', 'link')
    .attr('fill', 'none')
    .attr('stroke', (d) => (opts.activePath.has((d.target as PointDatum).data.id) ? '#d97706' : '#94a3b8'))
    .attr('stroke-opacity', 0.85)
    .attr('stroke-width', (d) => {
      const target = (d.target as PointDatum).data;
      const parent = (d.source as PointDatum).data;
      const tp = plays(target);
      const pp = plays(parent) || 1;
      const isActive = opts.activePath.has(target.id);
      const w = Math.max(1, Math.min(7, (tp / pp) * 7));
      return isActive ? Math.max(w, 3) : w;
    })
    .attr('d', (d) => {
      const s = d.source as PointDatum;
      const t = d.target as PointDatum;
      const mx = (s.y + t.y) / 2;
      return `M${s.y},${s.x} C${mx},${s.x} ${mx},${t.x} ${t.y},${t.x}`;
    });

  // Edge labels: placed close to the target node along the edge so they
  // travel with the branch rather than crowding the midpoint.
  g.append('g')
    .attr('class', 'edge-labels')
    .selectAll('text.edge')
    .data(links)
    .enter()
    .append('text')
    .attr('class', 'edge')
    .attr('font-size', 11)
    .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
    .attr('fill', '#475569')
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
    .style('stroke', 'white')
    .style('stroke-width', 3)
    .text((d) => (d.target as PointDatum).data.san ?? '');

  // nodes
  const nodeG = g
    .append('g')
    .attr('class', 'nodes')
    .selectAll<SVGGElement, PointDatum>('g.node')
    .data(nodes)
    .enter()
    .append('g')
    .attr('class', 'node')
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
    .attr('stroke', (d) => (opts.activePath.has(d.data.id) ? '#d97706' : '#64748b'))
    .attr('stroke-width', (d) => (opts.activePath.has(d.data.id) ? 3 : 1));

  // small "loading" pulse for nodes flagged loading
  nodeG
    .filter((d) => !!d.data.loading)
    .append('circle')
    .attr('r', (d) => nodeRadius(d.data) + 4)
    .attr('fill', 'none')
    .attr('stroke', '#d97706')
    .attr('stroke-width', 2)
    .attr('opacity', 0.5);

  // expand indicator (+) on collapsed nodes that have potential children
  nodeG
    .filter((d) => !d.data.expanded && plays(d.data) > 0)
    .append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .attr('font-size', 10)
    .attr('fill', '#1e293b')
    .text('+');

  // pan/zoom
  zoomBehavior = zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.3, 4])
    .on('zoom', (ev) => {
      g.attr('transform', ev.transform.toString());
    });
  (svg as Selection<SVGSVGElement, unknown, null, undefined>).call(zoomBehavior);

  // center root on left, vertically centered
  const initial = zoomIdentity.translate(60, opts.height / 2);
  (svg as Selection<SVGSVGElement, unknown, null, undefined>).call(zoomBehavior.transform, initial);
}
