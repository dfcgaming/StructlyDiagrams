import { app } from './state';
import { getNode, snap } from './model';
import { getCollapsedNodeIds, measureAllNodes, render } from './rendering';

export function fitToCanvas(): void {
  if (!app.model.nodes.length) return;
  measureAllNodes();

  const rect = document.getElementById('canvas')!.getBoundingClientRect();
  const minX = Math.min(...app.model.nodes.map((n) => n.x));
  const minY = Math.min(...app.model.nodes.map((n) => n.y));
  const maxX = Math.max(...app.model.nodes.map((n) => n.x + n.w));
  const maxY = Math.max(...app.model.nodes.map((n) => n.y + n.h));
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const scale = Math.max(0.35, Math.min(1.25, (rect.width - 100) / width, (rect.height - 100) / height));

  app.model.viewport.scale = scale;
  app.model.viewport.x = (rect.width - width * scale) / 2 - minX * scale;
  app.model.viewport.y = (rect.height - height * scale) / 2 - minY * scale;
  render();
}

export function autoLayout(): void {
  if (!app.model.nodes.length) return;

  const hiddenNodeIds = getCollapsedNodeIds();
  const visibleNodes = app.model.nodes.filter((n) => !hiddenNodeIds.has(n.id));
  if (!visibleNodes.length) return;

  measureAllNodes();

  const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
  const visibleConnections = app.model.connections.filter((c) =>
    !c.collapsed && visibleNodeIds.has(c.from) && visibleNodeIds.has(c.to)
  );

  const incomingVisible = new Set(visibleConnections.map((c) => c.to));
  const roots = visibleNodes.filter((n) => !incomingVisible.has(n.id));
  const visited = new Set<string>();
  const columnGap = 120;
  const rowGap = 60;
  const columnWidths: number[] = [];
  const rows: any[][] = [];

  function getVisibleChildren(nodeId: string) {
    return visibleConnections
      .filter((c) => c.from === nodeId)
      .map((c) => getNode(c.to))
      .filter(Boolean);
  }

  function place(node: any, depth: number): void {
    if (!node || visited.has(node.id) || hiddenNodeIds.has(node.id)) return;
    visited.add(node.id);
    columnWidths[depth] = Math.max(columnWidths[depth] || 0, node.w);
    if (!rows[depth]) rows[depth] = [];
    rows[depth].push(node);
    getVisibleChildren(node.id).forEach((child: any) => place(child, depth + 1));
  }

  roots.forEach((root) => place(root, 0));
  visibleNodes.filter((n) => !visited.has(n.id)).forEach((n) => place(n, 0));

  let x = 70;
  rows.forEach((column, depth) => {
    let y = 70;
    column.forEach((node: any) => {
      node.x = snap(x);
      node.y = snap(y);
      y += node.h + rowGap;
    });
    x += (columnWidths[depth] || 220) + columnGap;
  });

  app.model.viewport.scale = 1;
  app.model.viewport.x = 0;
  app.model.viewport.y = 0;
  render();
}
