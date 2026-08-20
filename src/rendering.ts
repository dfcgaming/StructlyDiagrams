import {
  SVG_NS, NODE_MIN_WIDTH, NODE_MAX_WIDTH, NODE_MIN_HEIGHT,
  TYPES, InfraNode, Connection, ExpandedDetail, AttachedService, CustomDetail
} from './types';
import { app } from './state';
import { getNode, getConnection, markDirty, selectItem, toggleNodeSelection, clearSelection, toggleExpanded, snap, normalizeConnection } from './model';

const $ = (id: string) => document.getElementById(id)!;

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c] || c));
}

export function createElement(tag: string, className = '', html = ''): HTMLElement {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (html) el.innerHTML = html;
  return el;
}

export function toast(message: string): void {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(app.toastTimer!);
  app.toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

export function fieldHtml(label: string, key: string, value: string, type = 'text', placeholder = ''): string {
  return `<div class="field"><label>${escapeHtml(label)}</label><input data-key="${escapeHtml(key)}" type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"></div>`;
}

export function selectHtml(label: string, key: string, value: string, options: string[]): string {
  return `<div class="field"><label>${escapeHtml(label)}</label><select data-key="${escapeHtml(key)}">${options.map((o) => `<option value="${escapeHtml(o)}" ${o === value ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}</select></div>`;
}

export function textareaHtml(label: string, key: string, value: string, placeholder = ''): string {
  return `<div class="field"><label>${escapeHtml(label)}</label><textarea data-key="${escapeHtml(key)}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea></div>`;
}

export function formatKey(key: string): string {
  return String(key).replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

export function setObjectPath(object: Record<string, unknown>, path: string, value: string): void {
  const keys = path.split('.');
  let target: any = object;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!target[keys[i]]) target[keys[i]] = {};
    target = target[keys[i]];
  }
  const key = keys[keys.length - 1];
  if (key === 'x' || key === 'y') target[key] = Number(value) || 0;
  else if (path === 'props.wan' || path === 'props.lan' || path === 'props.roles')
    target[key] = String(value).split(',').map((s) => s.trim()).filter(Boolean);
  else if (value === 'true' || value === 'false') target[key] = value === 'true';
  else target[key] = value;
}

/* ============================================================
   NODE LABELS
   ============================================================ */

export function getNodeLabels(node: InfraNode): string[] {
  return Array.isArray(node?.labels) ? node.labels.map(String).map((l) => l.trim()).filter(Boolean) : [];
}

export function setNodeLabels(node: InfraNode, labels: string[]): void {
  node.labels = Array.from(new Set((labels || []).map((l) => String(l).trim()).filter(Boolean)));
}

export function addNodeLabel(node: InfraNode, label: string): boolean {
  const clean = String(label || '').trim();
  if (!clean) return false;
  const labels = getNodeLabels(node);
  if (labels.some((l) => l.toLowerCase() === clean.toLowerCase())) return false;
  labels.push(clean);
  setNodeLabels(node, labels);
  return true;
}

export function removeNodeLabel(node: InfraNode, label: string): void {
  setNodeLabels(node, getNodeLabels(node).filter((l) => l !== label));
}

export function getAvailableLabels(): string[] {
  const labels = new Set<string>();
  app.model.nodes.forEach((n) => getNodeLabels(n).forEach((l) => labels.add(l)));
  return Array.from(labels).sort((a, b) => a.localeCompare(b));
}

/* ============================================================
   EXPANDED DETAILS
   ============================================================ */

export function getExpandedDetails(node: InfraNode): ExpandedDetail[] {
  const p: Record<string, any> = node.props || {};
  const details: ExpandedDetail[] = [];
  const add = (title: string, text = '', chips: string[] = []) =>
    details.push({ title, text, chips: chips.filter(Boolean) });

  if (node.type === 'firewall') {
    add('WAN Interfaces', (p.wan || []).join(' \u2022 ') || 'None configured');
    add('LAN Interfaces', (p.lan || []).join(' \u2022 ') || 'None configured');
    (p.natRules || []).forEach((rule: any, i: number) =>
      add(`NAT ${i + 1}: ${rule.name || 'Port Forward'}`, `${rule.protocol || 'TCP'} ${rule.publicPort || ''} \u2192 ${rule.target || ''}`));
    (p.firewallRules || []).forEach((rule: any, i: number) =>
      add(`Rule ${i + 1}: ${rule.name || 'Firewall Rule'}`, `${rule.source || 'Any'} \u2192 ${rule.destination || 'Any'} \u2022 ${rule.service || 'Any'} \u2022 ${rule.action || 'Allow'}`));
  }
  if (node.type === 'ad') {
    add('Domain', p.domain || 'AD Domain', [p.site || 'HQ', p.functionalLevel || '']);
    add('Domain Controllers', 'AD DS \u2022 DNS \u2022 Kerberos \u2022 LDAP \u2022 SYSVOL');
    add('Replication', 'Bidirectional \u2022 RPC \u2022 Site aware');
    add('FSMO Roles', 'Schema \u2022 Domain Naming \u2022 RID \u2022 PDC \u2022 Infrastructure');
  }
  if (node.type === 'dc') {
    add('Hostname', p.hostname || 'DC01');
    add('IP Address', p.ip || '');
    add('Site', p.site || 'HQ');
    add('Roles', (p.roles || []).join(' \u2022 ') || 'AD DS');
    add('Replication', 'Inbound / Outbound \u2022 RPC');
  }
  if (node.type === 'sync') {
    add('Status', p.status || 'Unknown');
    add('Scope', p.scope || 'Users, Groups');
    add('Last Sync', p.lastSync || '');
    add('Direction', 'On-premises AD \u2192 Entra ID');
  }
  if (node.type === 'm365') {
    add('Tenant', p.tenant || '');
    add('Users', String(p.users || ''));
    (p.services || []).forEach((s: string) => add(s, 'Microsoft 365 cloud service'));
  }
  if (node.type === 'server') {
    add('Hostname', p.hostname || '');
    add('IP Address', p.ip || '');
    add('Operating System', p.os || '');
  }
  if (node.type === 'vlan') {
    add('VLAN ID', p.id || '');
    add('Subnet', p.subnet || '');
    add('Gateway', p.gateway || '');
  }
  if (node.type === 'gateway') { add('Gateway IP', p.address || ''); add('VLAN', p.vlan || ''); }
  if (node.type === 'publicIp') add('Address', p.address || '');
  if (node.type === 'dns') add('Host', p.host || '', [p.ip || '']);
  if (node.type === 'dhcp') add('Scope', p.scope || '', [p.gateway || '', p.dns || '']);
  if (node.type === 'service') add('Service', p.service || 'Service', [`${p.protocol || 'TCP'}:${p.port || ''}`]);
  if (node.type === 'vpn') { add('Type', p.kind || 'Site-to-site'); add('Remote', p.remote || ''); add('Status', p.status || 'Unknown'); }

  (node.attachedServices || []).forEach((svc) => {
    const chips = [svc.status, svc.protocol && svc.port ? `${svc.protocol}:${svc.port}` : '', svc.scope].filter(Boolean);
    add(svc.name || 'Service', svc.notes || svc.scope || 'Attached service', chips);
  });

  node.customDetails.forEach((d) => add(d.title || 'Note', d.text || '', d.chips || []));
  return details;
}

/* ============================================================
   NODE MARKUP & SIZING
   ============================================================ */

export function renderRelationToggleMarkup(node: InfraNode): string {
  const outgoing = app.model.connections.filter((c) => c.from === node.id && c.fromPort === 'out');
  if (!outgoing.length) return '';
  const allCollapsed = outgoing.every((c) => Boolean(c.collapsed));
  const collapsed = allCollapsed;
  const title = collapsed ? 'Show all branches from this output port' : 'Hide all branches from this output port';
  return `<button class="relation-toggle ${collapsed ? 'collapsed' : ''}" data-relation-port="out" data-relation-node="${escapeHtml(node.id)}" type="button" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">${collapsed ? '\u203A' : '\u2212'}</button>`;
}

export function getNodeMarkup(node: InfraNode, measurement = false): string {
  const definition = TYPES[node.type] || TYPES.service;
  const allDetails = getExpandedDetails(node);
  const details = node.expanded ? allDetails : [];
  const hasChildren = allDetails.length > 0;
  const chips = Array.isArray(node.labels) ? node.labels : [];
  const detailsHtml = node.expanded && details.length
    ? `<div class="details">${details.map((d) => `
        <div class="detail-row">
          <div class="detail-title">${escapeHtml(d.title)}</div>
          ${d.text ? `<div class="detail-meta">${escapeHtml(d.text)}</div>` : ''}
          ${d.chips?.length ? `<div class="detail-chips">${d.chips.map((c) => `<span class="chip">${escapeHtml(c)}</span>`).join('')}</div>` : ''}
        </div>`).join('')}</div>`
    : '';

  return `
    ${measurement ? '' : '<div class="port in" data-port="in"></div><div class="port out" data-port="out"></div>'}
    <div class="head">
      <div class="icon" style="background:${definition.color}33">${escapeHtml(definition.icon)}</div>
      <div class="title-wrap">
        <div class="title">${escapeHtml(node.name)}</div>
        <div class="sub">${escapeHtml(node.description || definition.desc)}</div>
      </div>
    </div>
    <div class="body">
      ${chips.length ? `<div class="chips">${chips.map((c) => `<span class="chip">${escapeHtml(c)}</span>`).join('')}</div>` : ''}
      ${detailsHtml}
    </div>
    ${measurement ? '' : `<div class="footer"><button class="child-toggle" type="button" aria-expanded="${node.expanded ? 'true' : 'false'}" title="${node.expanded ? 'Collapse child details' : 'Expand child details'}" ${hasChildren ? '' : 'disabled'}>${node.expanded ? '\u2303' : '\u203A'} Expand</button></div>`}
    ${measurement ? '' : renderRelationToggleMarkup(node)}`;
}

export function measureNodeSize(node: InfraNode): void {
  const measurement = createElement('div', 'node node-measure');
  measurement.innerHTML = getNodeMarkup(node, true);
  measurement.style.position = 'absolute';
  measurement.style.left = '-100000px';
  measurement.style.top = '-100000px';
  measurement.style.visibility = 'hidden';
  measurement.style.width = 'max-content';
  measurement.style.maxWidth = `${NODE_MAX_WIDTH}px`;
  measurement.style.height = 'auto';
  measurement.style.minHeight = `${NODE_MIN_HEIGHT}px`;
  $('nodes').appendChild(measurement);

  const naturalWidth = Math.ceil(measurement.scrollWidth + 2);
  const width = Math.max(NODE_MIN_WIDTH, Math.min(NODE_MAX_WIDTH, naturalWidth));
  measurement.style.width = `${width}px`;
  const height = Math.max(NODE_MIN_HEIGHT, Math.ceil(measurement.scrollHeight + 2));

  measurement.remove();
  node.w = width;
  node.h = height;
}

export function measureAllNodes(): void {
  app.model.nodes.forEach(measureNodeSize);
}

/* ============================================================
   CONNECTION GEOMETRY
   ============================================================ */

export function getPortPoint(node: InfraNode, port = 'out'): { x: number; y: number } {
  if (port === 'in') return { x: node.x, y: node.y + node.h / 2 };
  if (port === 'out') return { x: node.x + node.w, y: node.y + node.h / 2 };
  if (port === 'top') return { x: node.x + node.w / 2, y: node.y };
  return { x: node.x + node.w / 2, y: node.y + node.h };
}

export function buildEdgePath(nodeA: InfraNode, nodeB: InfraNode, fromPort = 'out', toPort = 'in'): string {
  const start = getPortPoint(nodeA, fromPort);
  const end = getPortPoint(nodeB, toPort);

  if (Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)) {
    const distance = Math.max(50, Math.abs(end.x - start.x) * 0.45);
    const dir = end.x >= start.x ? 1 : -1;
    return `M ${start.x} ${start.y} C ${start.x + dir * distance} ${start.y}, ${end.x - dir * distance} ${end.y}, ${end.x} ${end.y}`;
  }
  const distance = Math.max(50, Math.abs(end.y - start.y) * 0.45);
  const dir = end.y >= start.y ? 1 : -1;
  return `M ${start.x} ${start.y} C ${start.x} ${start.y + dir * distance}, ${end.x} ${end.y - dir * distance}, ${end.x} ${end.y}`;
}

export function buildPartialEdgePath(nodeA: InfraNode, nodeB: InfraNode, fromPort = 'out', toPort = 'in', fraction = 0.5): string {
  const start = getPortPoint(nodeA, fromPort);
  const end = getPortPoint(nodeB, toPort);
  const mid = { x: start.x + (end.x - start.x) * fraction, y: start.y + (end.y - start.y) * fraction };
  if (Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)) {
    const distance = Math.max(50, Math.abs(end.x - start.x) * 0.45);
    const dir = end.x >= start.x ? 1 : -1;
    return `M ${start.x} ${start.y} C ${start.x + dir * distance * fraction} ${start.y}, ${mid.x - dir * distance * 0.35} ${mid.y}, ${mid.x} ${mid.y}`;
  }
  const distance = Math.max(50, Math.abs(end.y - start.y) * 0.45);
  const dir = end.y >= start.y ? 1 : -1;
  return `M ${start.x} ${start.y} C ${start.x} ${start.y + dir * distance * fraction}, ${mid.x} ${mid.y - dir * distance * 0.35}, ${mid.x} ${mid.y}`;
}

export function getWorldPoint(clientX: number, clientY: number): { x: number; y: number } {
  const rect = $('canvas').getBoundingClientRect();
  return {
    x: (clientX - rect.left - app.model.viewport.x) / app.model.viewport.scale,
    y: (clientY - rect.top - app.model.viewport.y) / app.model.viewport.scale
  };
}

/* ============================================================
   COLLAPSE / BRANCH VISIBILITY
   ============================================================ */

export function getCollapsedNodeIds(): Set<string> {
  const hidden = new Set<string>();
  const queue: string[] = [];
  app.model.connections.forEach((c) => {
    if (c.collapsed && getNode(c.from) && getNode(c.to)) queue.push(c.to);
  });
  while (queue.length) {
    const id = queue.shift()!;
    if (hidden.has(id)) continue;
    hidden.add(id);
    app.model.connections.forEach((c) => {
      if (c.from === id && !hidden.has(c.to)) queue.push(c.to);
    });
  }
  return hidden;
}

export function toggleOutputPortCollapsed(nodeId: string, port = 'out'): void {
  const outgoing = app.model.connections.filter((c) => c.from === nodeId && c.fromPort === port);
  if (!outgoing.length) return;
  const allCollapsed = outgoing.every((c) => Boolean(c.collapsed));
  const nextCollapsed = !allCollapsed;
  outgoing.forEach((c) => { c.collapsed = nextCollapsed; });
  if (app.selected?.kind === 'connection' && outgoing.some((c) => c.id === app.selected!.id)) {
    renderInspector();
  }
  markDirty();
  render();
  toast(nextCollapsed ? 'All branches from this port collapsed' : 'All branches from this port expanded');
}

export function toggleConnectionCollapsed(connectionId: string): void {
  const conn = getConnection(connectionId);
  if (!conn) return;
  conn.collapsed = !conn.collapsed;
  if (app.selected?.kind === 'connection' && app.selected.id === connectionId) renderInspector();
  markDirty();
  render();
  toast(conn.collapsed ? 'Branch collapsed' : 'Branch expanded');
}

/* ============================================================
   RENDERING
   ============================================================ */

export function render(): void {
  measureAllNodes();
  renderWorldTransform();
  renderConnections();
  renderNodes();
  renderStatus();
}

export function renderWorldTransform(): void {
  const world = $('world');
  world.style.transform = `translate(${app.model.viewport.x}px, ${app.model.viewport.y}px) scale(${app.model.viewport.scale})`;
  $('empty').style.display = app.model.nodes.length ? 'none' : 'grid';
}

export function renderConnections(): void {
  const svg = $('edges') as unknown as SVGSVGElement;
  svg.innerHTML = '';
  if (!app.connectionsVisible) {
    if (app.connectDrag) renderConnectionPreview(svg);
    return;
  }

  const hiddenNodeIds = getCollapsedNodeIds();
  app.model.connections.forEach((connection) => {
    const fromNode = getNode(connection.from);
    const toNode = getNode(connection.to);
    if (!fromNode || !toNode || hiddenNodeIds.has(connection.from) || hiddenNodeIds.has(connection.to)) return;

    const path = document.createElementNS(SVG_NS, 'path');
    const classes = ['edge'];
    if (connection.kind === 'replication') classes.push('replication');
    if (connection.collapsed) classes.push('collapsed');
    if (app.selected?.kind === 'connection' && app.selected.id === connection.id) classes.push('selected');
    path.setAttribute('class', classes.join(' '));
    path.setAttribute('d', connection.collapsed
      ? buildPartialEdgePath(fromNode, toNode, connection.fromPort, connection.toPort, 0.5)
      : buildEdgePath(fromNode, toNode, connection.fromPort, connection.toPort));
    path.style.pointerEvents = 'stroke';
    path.dataset.id = connection.id;
    path.addEventListener('click', (e) => { e.stopPropagation(); selectItem('connection', connection.id); });
    svg.appendChild(path);
  });

  if (app.connectDrag) renderConnectionPreview(svg);
}

export function renderConnectionPreview(svg: SVGSVGElement): void {
  const sourceNode = getNode(app.connectDrag!.nodeId);
  if (!sourceNode) return;
  const start = getPortPoint(sourceNode, app.connectDrag!.port);
  const end = app.connectDrag!.current;
  const distance = Math.max(50, Math.abs(end.x - start.x) * 0.45);
  const dir = end.x >= start.x ? 1 : -1;
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('class', 'edge preview');
  path.setAttribute('d', `M ${start.x} ${start.y} C ${start.x + dir * distance} ${start.y}, ${end.x - dir * distance} ${end.y}, ${end.x} ${end.y}`);
  svg.appendChild(path);
}

export function renderNodes(): void {
  const container = $('nodes');
  container.innerHTML = '';
  const hiddenNodeIds = getCollapsedNodeIds();

  app.model.nodes.forEach((node) => {
    if (hiddenNodeIds.has(node.id)) return;
    const isSelected = app.selected?.kind === 'node' && app.selected.id === node.id;
    const isMultiSelected = app.multiSelected.has(node.id);
    const isLabelHighlighted = app.activeLabels.length > 0 && (node.labels || []).some((l) => app.activeLabels.includes(l));
    const classes = ['node'];
    if (isSelected) classes.push('selected');
    if (isMultiSelected) classes.push('multi-selected');
    if (isLabelHighlighted) classes.push('label-highlight');
    const element = createElement('div', classes.join(' '));
    element.dataset.id = node.id;
    element.style.left = `${node.x}px`;
    element.style.top = `${node.y}px`;
    element.style.width = `${node.w}px`;
    element.style.height = `${node.h}px`;
    element.style.zIndex = isSelected ? '1000' : (isMultiSelected ? '800' : (isLabelHighlighted ? '300' : '10'));
    element.innerHTML = getNodeMarkup(node, false);
    bindNodeEvents(element, node);
    container.appendChild(element);
  });
}

export function renderStatus(): void {
  $('status').textContent = app.dirty ? 'Unsaved changes' : (app.model.project.name || 'Ready');
}

/* ============================================================
   NODE EVENTS
   ============================================================ */

function bindNodeEvents(element: HTMLElement, node: InfraNode): void {
  element.addEventListener('mousedown', (e) => startNodeDrag(e, node.id));
  element.addEventListener('click', (e) => {
    if ((e.target as HTMLElement)?.closest('.child-toggle') || (e.target as HTMLElement)?.closest('.port')) return;
    if (e.shiftKey) {
      toggleNodeSelection(node.id);
    } else if (!app.nodeDrag) {
      selectItem('node', node.id);
    }
    render();
    renderInspector();
  });

  const expandButton = element.querySelector('.child-toggle') as HTMLButtonElement | null;
  if (expandButton) {
    expandButton.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleExpanded(node.id);
      render();
      renderInspector();
    });
  }

  element.querySelectorAll('[data-relation-port]').forEach((btn) => {
    const button = btn as HTMLButtonElement;
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleOutputPortCollapsed(button.dataset.relationNode!, button.dataset.relationPort!);
    });
    button.addEventListener('mousedown', (e) => e.stopPropagation());
    button.addEventListener('pointerdown', (e) => e.stopPropagation());
  });

  element.querySelectorAll('.port').forEach((port) => {
    const portEl = port as HTMLElement;
    portEl.title = portEl.dataset.port === 'out' ? 'Drag to another node input' : 'Drop connection here';
    portEl.addEventListener('pointerdown', (e) => startConnectionDrag(e, node.id, portEl.dataset.port!));
    portEl.addEventListener('click', (e) => e.stopPropagation());
  });
}

/* ============================================================
   NODE DRAGGING
   ============================================================ */

function startNodeDrag(event: MouseEvent, nodeId: string): void {
  if (event.button !== 0 || (event.target as HTMLElement).closest('.port') || (event.target as HTMLElement).closest('.child-toggle')) return;
  event.preventDefault();

  if (event.shiftKey) {
    toggleNodeSelection(nodeId);
    render();
    renderInspector();
    return;
  }

  if (!app.multiSelected.has(nodeId)) {
    app.multiSelected.clear();
    app.multiSelected.add(nodeId);
    app.selected = { kind: 'node', id: nodeId };
    render();
    renderInspector();
  }

  const point = getWorldPoint(event.clientX, event.clientY);
  const selectedIds = [...app.multiSelected];
  app.nodeDrag = {
    startX: point.x,
    startY: point.y,
    items: selectedIds.map((id) => {
      const node = getNode(id);
      return node ? { id, startX: node.x, startY: node.y } : null;
    }).filter(Boolean) as { id: string; startX: number; startY: number }[]
  };

  document.addEventListener('mousemove', handleNodeDrag);
  document.addEventListener('mouseup', stopNodeDrag, { once: true });
}

function handleNodeDrag(event: MouseEvent): void {
  if (!app.nodeDrag) return;
  const point = getWorldPoint(event.clientX, event.clientY);
  const dx = point.x - app.nodeDrag.startX;
  const dy = point.y - app.nodeDrag.startY;
  app.nodeDrag.items.forEach((item) => {
    const node = getNode(item.id);
    if (!node) return;
    node.x = snap(item.startX + dx);
    node.y = snap(item.startY + dy);
  });
  markDirty();
  render();
}

function stopNodeDrag(): void {
  app.nodeDrag = null;
  document.removeEventListener('mousemove', handleNodeDrag);
}

/* ============================================================
   PANNING
   ============================================================ */

function startPan(event: MouseEvent): void {
  app.pan = {
    startX: event.clientX,
    startY: event.clientY,
    originX: app.model.viewport.x,
    originY: app.model.viewport.y
  };
  document.addEventListener('mousemove', handlePan);
  document.addEventListener('mouseup', stopPan, { once: true });
}

function handlePan(event: MouseEvent): void {
  if (!app.pan) return;
  app.model.viewport.x = app.pan.originX + (event.clientX - app.pan.startX);
  app.model.viewport.y = app.pan.originY + (event.clientY - app.pan.startY);
  render();
}

function stopPan(): void {
  app.pan = null;
  document.removeEventListener('mousemove', handlePan);
}

/* ============================================================
   MARQUEE SELECTION
   ============================================================ */

function startMarquee(event: MouseEvent): void {
  const rect = $('canvas').getBoundingClientRect();
  app.marquee = {
    startClientX: event.clientX,
    startClientY: event.clientY,
    startCanvasX: event.clientX - rect.left,
    startCanvasY: event.clientY - rect.top,
    additive: event.shiftKey
  };
  if (!app.marquee.additive) {
    app.multiSelected.clear();
    app.selected = null;
  }
  updateMarquee(event);
  document.addEventListener('mousemove', updateMarquee);
  document.addEventListener('mouseup', finishMarquee, { once: true });
}

function updateMarquee(event: MouseEvent): void {
  if (!app.marquee) return;
  const rect = $('canvas').getBoundingClientRect();
  const currentX = event.clientX - rect.left;
  const currentY = event.clientY - rect.top;
  const left = Math.min(app.marquee.startCanvasX, currentX);
  const top = Math.min(app.marquee.startCanvasY, currentY);
  const width = Math.abs(currentX - app.marquee.startCanvasX);
  const height = Math.abs(currentY - app.marquee.startCanvasY);

  const box = $('selectionBox');
  box.style.left = `${left}px`;
  box.style.top = `${top}px`;
  box.style.width = `${width}px`;
  box.style.height = `${height}px`;
  box.classList.add('show');

  const boxRect = { left: rect.left + left, top: rect.top + top, right: rect.left + left + width, bottom: rect.top + top + height };
  if (width < 4 && height < 4) return;

  app.model.nodes.forEach((node) => {
    const el = document.querySelector(`.node[data-id="${CSS.escape(node.id)}"]`) as HTMLElement | null;
    if (!el) return;
    const nr = el.getBoundingClientRect();
    const intersects = nr.left < boxRect.right && nr.right > boxRect.left && nr.top < boxRect.bottom && nr.bottom > boxRect.top;
    if (intersects) app.multiSelected.add(node.id);
    else if (!app.marquee!.additive) app.multiSelected.delete(node.id);
  });

  const ids = [...app.multiSelected];
  app.selected = ids.length ? (ids.length === 1 ? { kind: 'node', id: ids[0] } : { kind: 'nodes', id: ids }) : null;
  render();
}

function finishMarquee(): void {
  if (!app.marquee) return;
  app.marquee = null;
  $('selectionBox').classList.remove('show');
  document.removeEventListener('mousemove', updateMarquee);
  render();
  renderInspector();
}

/* ============================================================
   CONNECTION DRAWING
   ============================================================ */

function startConnectionDrag(event: PointerEvent, nodeId: string, port: string): void {
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();

  app.connectDrag = {
    nodeId,
    port,
    current: getWorldPoint(event.clientX, event.clientY)
  };

  document.addEventListener('pointermove', handleConnectionDrag);
  document.addEventListener('pointerup', finishConnectionDrag, { once: true });
  render();
}

function handleConnectionDrag(event: PointerEvent): void {
  if (!app.connectDrag) return;
  app.connectDrag.current = getWorldPoint(event.clientX, event.clientY);

  document.querySelectorAll('.port.active').forEach((p) => p.classList.remove('active'));
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.port');
  if (target && (target as HTMLElement).dataset.port === 'in') target.classList.add('active');
  render();
}

function finishConnectionDrag(event: PointerEvent): void {
  if (!app.connectDrag) return;
  const source = { ...app.connectDrag };
  const targetPort = document.elementFromPoint(event.clientX, event.clientY)?.closest('.port') as HTMLElement | null;
  document.querySelectorAll('.port.active').forEach((p) => p.classList.remove('active'));

  if (targetPort?.dataset.port === 'in') {
    const targetNode = targetPort.closest('.node') as HTMLElement | null;
    const targetId = targetNode?.dataset.id;
    if (targetId && targetId !== source.nodeId) createConnection(source.nodeId, source.port, targetId, 'in');
    else cancelConnectionDrag();
  } else {
    cancelConnectionDrag();
  }
}

function createConnection(sourceId: string, sourcePort: string, targetId: string, targetPort: string): void {
  let from = sourceId;
  let fromPort = sourcePort;
  let to = targetId;
  let toPort = targetPort;

  if (fromPort === 'in' && toPort === 'out') {
    [from, to] = [to, from];
    [fromPort, toPort] = [toPort, fromPort];
  }
  fromPort = 'out';
  toPort = 'in';

  if (from === to) { cancelConnectionDrag(); return; }
  if (app.model.connections.some((c) => c.from === from && c.to === to)) {
    cancelConnectionDrag();
    toast('Connection already exists');
    return;
  }

  const conn = normalizeConnection({ from, to, fromPort, toPort, kind: 'network', label: 'Connection' });
  app.model.connections.push(conn);
  app.selected = { kind: 'connection', id: conn.id };
  app.connectDrag = null;
  markDirty();
  render();
  renderInspector();
  toast('Connection created');
}

function cancelConnectionDrag(): void {
  app.connectDrag = null;
  render();
}

export { startNodeDrag, startPan, startMarquee, startConnectionDrag as startConnectionDragExported };

/* ============================================================
   INSPECTOR
   ============================================================ */

export function renderInspector(): void {
  const container = $('inspectorContent');
  if (!app.selected) {
    renderGlobalInspector(container);
    return;
  }
  if (app.selected.kind === 'node') {
    renderNodeInspector(container, getNode(app.selected.id as string));
    return;
  }
  if (app.selected.kind === 'connection') {
    renderConnectionInspector(container, getConnection(app.selected.id as string));
    return;
  }
}

function renderGlobalInspector(container: HTMLElement): void {
  const labels = getAvailableLabels();
  container.innerHTML = `
    <h3 class="inspector-title">Inspector</h3>
    <div class="muted section-help">Nothing selected. Press one or more labels to highlight every model that uses them.</div>
    <div class="section inner-section">
      <h3>Highlight labels</h3>
      <div class="label-filter">
        ${labels.length ? labels.map((l) => `<button type="button" class="label-toggle ${app.activeLabels.includes(l) ? 'active' : ''}" data-label="${escapeHtml(l)}">${escapeHtml(l)}</button>`).join('') : '<div class="muted">No labels have been added to models yet.</div>'}
        <div class="label-count">${app.activeLabels.length ? `${app.activeLabels.length} selected \u2022 ${app.model.nodes.filter((n) => getNodeLabels(n).some((l) => app.activeLabels.includes(l))).length} matching models` : 'Click a label to highlight matching models.'}</div>
      </div>
    </div>
    <div class="section inner-section">
      <h3>Quick actions</h3>
      <div class="actions"><button id="clearLabelHighlights">Clear highlights</button><button id="selectAllLabelMatches">Select matching models</button></div>
    </div>`;

  container.querySelectorAll('.label-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const label = (btn as HTMLElement).dataset.label!;
      app.activeLabels = app.activeLabels.includes(label) ? app.activeLabels.filter((l) => l !== label) : [...app.activeLabels, label];
      render();
      renderInspector();
    });
  });
  container.querySelector('#clearLabelHighlights')?.addEventListener('click', () => {
    app.activeLabels = [];
    render();
    renderInspector();
  });
  container.querySelector('#selectAllLabelMatches')?.addEventListener('click', () => {
    const matches = app.model.nodes.filter((n) => (n.labels || []).some((l) => app.activeLabels.includes(l)));
    if (matches.length) app.selected = { kind: 'node', id: matches[0].id };
    render();
    renderInspector();
  });
}

function renderAttachedServiceEditors(node: InfraNode): string {
  if (!(node.attachedServices || []).length) return '<div class="muted empty-details">No services attached yet.</div>';
  return node.attachedServices.map((svc, i) => `
    <div class="custom-detail-editor attached-service-editor" data-service-id="${escapeHtml(svc.id)}">
      <div class="custom-detail-head"><strong>Service ${i + 1}</strong><button type="button" class="delete-service danger">Remove</button></div>
      ${selectHtml('Service', 'service.name', svc.name, [...new Set([...(['DHCP', 'DNS', 'NAT', 'Firewall', 'VPN', 'HTTP', 'HTTPS', 'RDP', 'SSH', 'SMB', 'LDAP', 'Kerberos', 'SQL', 'NTP', 'RADIUS', 'Syslog', 'Monitoring', 'Backup', 'Proxy', 'Reverse Proxy', 'WAF', 'EDR', 'AD DS', 'Entra Connect', 'Exchange', 'Teams', 'SharePoint', 'OneDrive', 'Intune', 'Defender', 'Custom']), svc.name])] )}
      ${fieldHtml('Status', 'service.status', svc.status)}
      ${fieldHtml('Scope / applies to', 'service.scope', svc.scope, 'text', 'Example: VLAN 20 only / 10.10.20.0/24 / WAN interface')}
      <div class="row">
        <div class="field"><label>Protocol</label><input data-key="service.protocol" value="${escapeHtml(svc.protocol)}" placeholder="TCP"></div>
        <div class="field"><label>Port</label><input data-key="service.port" value="${escapeHtml(svc.port)}" placeholder="443"></div>
      </div>
      ${textareaHtml('Notes', 'service.notes', svc.notes, 'Optional configuration notes')}
    </div>`).join('');
}

function renderCustomDetailEditor(detail: CustomDetail, index: number): string {
  return `<div class="custom-detail-editor" data-detail-id="${escapeHtml(detail.id)}">
    <div class="custom-detail-head"><strong>Child ${index + 1}</strong><button type="button" class="delete-detail danger">Remove</button></div>
    ${fieldHtml('Title', 'detail.title', detail.title)}
    ${textareaHtml('Text', 'detail.text', detail.text, 'Optional note, explanation, IP, role, dependency, etc.')}
    ${fieldHtml('Chips (comma separated)', 'detail.chips', (detail.chips || []).join(', '), 'text', 'Optional tags')}
  </div>`;
}

function renderNodeInspector(container: HTMLElement, node: InfraNode | undefined): void {
  if (!node) return;
  const p: Record<string, any> = node.props || {};
  const definition = TYPES[node.type] || TYPES.service;

  let propertySection = '';
  if (node.type === 'firewall') {
    propertySection = `<div class="section inner-section"><h3>Firewall</h3>
      ${fieldHtml('Model', 'props.model', p.model || '')}
      ${fieldHtml('WAN IPs (comma separated)', 'props.wan', (p.wan || []).join(', '))}
      ${fieldHtml('LAN IPs (comma separated)', 'props.lan', (p.lan || []).join(', '))}
      <div class="actions"><button id="addNat">Add NAT rule</button><button id="addRule">Add firewall rule</button></div>
    </div>`;
  } else if (node.type === 'ad') {
    propertySection = `<div class="section inner-section"><h3>Directory</h3>
      ${fieldHtml('Domain', 'props.domain', p.domain || '')}
      ${fieldHtml('Site', 'props.site', p.site || '')}
      ${fieldHtml('Functional level', 'props.functionalLevel', p.functionalLevel || '')}
    </div>`;
  } else if (node.type === 'dc') {
    propertySection = `<div class="section inner-section"><h3>Domain Controller</h3>
      ${fieldHtml('Hostname', 'props.hostname', p.hostname || '')}
      ${fieldHtml('IP address', 'props.ip', p.ip || '')}
      ${fieldHtml('Site', 'props.site', p.site || '')}
      ${fieldHtml('Roles (comma separated)', 'props.roles', (p.roles || []).join(', '))}
    </div>`;
  } else {
    const editable = Object.entries(p).filter(([, v]) => ['string', 'number', 'boolean'].includes(typeof v));
    propertySection = editable.length
      ? `<div class="section inner-section"><h3>Properties</h3>${editable.map(([k, v]) => fieldHtml(formatKey(k), `props.${k}`, String(v))).join('')}</div>`
      : '';
  }

  const customDetailsHtml = node.customDetails.length
    ? node.customDetails.map((d, i) => renderCustomDetailEditor(d, i)).join('')
    : `<div class="muted empty-details">No custom notes or child details yet.</div>`;

  container.innerHTML = `
    <h3 class="inspector-title">${escapeHtml(node.name)}</h3>
    <div class="type-badge">${escapeHtml(definition.label)}</div>
    ${fieldHtml('Name', 'name', node.name)}
    ${textareaHtml('Placeholder / description', 'description', node.description || definition.desc, 'Short description shown below the title')}
    <div class="section inner-section">
      <h3>Model labels</h3>
      <div class="muted section-help">Labels belong to this model. Add or remove them here. When nothing is selected, these same labels become the global highlight selector.</div>
      <div class="label-editor" id="nodeLabelEditor">
        ${getNodeLabels(node).map((l) => `<span class="label-token">${escapeHtml(l)}<button type="button" class="remove-node-label" data-label="${escapeHtml(l)}" title="Remove label">\u00D7</button></span>`).join('')}
        <input id="nodeLabelInput" class="label-editor-input" type="text" placeholder="Add label and press Enter">
      </div>
      <div class="label-editor-actions"><button type="button" id="addNodeLabel">Add label</button></div>
      <div class="label-hint">Examples: Production, Critical, DHCP, VLAN 30, DMZ, Owner: IT.</div>
    </div>
    <div class="row">
      <div class="field"><label>X</label><input data-key="x" type="number" value="${node.x}"></div>
      <div class="field"><label>Y</label><input data-key="y" type="number" value="${node.y}"></div>
    </div>
    <div class="actions">
      <button id="toggleExpand">${node.expanded ? 'Collapse' : 'Expand'} details</button>
      <button id="deleteNode" class="danger">Delete</button>
    </div>
    ${propertySection}
    <div class="section inner-section attached-services-section">
      <h3>Attached services / capabilities</h3>
      <div class="muted section-help">Add any service to any model. Use Scope to say where it actually applies, such as VLAN 20 only, one subnet, one interface, or the whole system.</div>
      ${renderAttachedServiceEditors(node)}
      <button id="addService" class="primary full-width">+ Add service / capability</button>
    </div>
    <div class="section inner-section custom-details-section">
      <h3>Dynamic child details</h3>
      <div class="muted section-help">Add notes or any custom child item. They appear inside this model when it is expanded.</div>
      ${customDetailsHtml}
      <button id="addDetail" class="primary full-width">+ Add note / child detail</button>
    </div>`;

  bindInspectorFields(container, node);
  bindNodeInspectorButtons(container, node);
}

function bindInspectorFields(container: HTMLElement, node: InfraNode): void {
  container.querySelectorAll('[data-key]').forEach((field) => {
    const el = field as HTMLInputElement;
    if (el.dataset.key!.startsWith('detail.') || el.dataset.key!.startsWith('service.')) return;
    el.addEventListener('change', () => {
      if (el.dataset.key === 'labels') {
        node.labels = el.value.split(',').map((s) => s.trim()).filter(Boolean);
      } else {
        setObjectPath(node as unknown as Record<string, unknown>, el.dataset.key!, el.value);
      }
      markDirty();
      render();
      renderInspector();
    });
  });
}

function bindNodeInspectorButtons(container: HTMLElement, node: InfraNode): void {
  container.querySelector('#toggleExpand')?.addEventListener('click', () => {
    toggleExpanded(node.id);
    render();
    renderInspector();
  });
  container.querySelector('#deleteNode')?.addEventListener('click', () => {
    const { removeNode: rm } = require('./model');
    rm(node.id);
    render();
    renderInspector();
  });

  container.querySelector('#addDetail')?.addEventListener('click', () => {
    const { createDetail } = require('./model');
    node.customDetails.push(createDetail('Note', '', []));
    node.expanded = true;
    markDirty();
    render();
    renderInspector();
  });

  container.querySelector('#addService')?.addEventListener('click', () => {
    const { createAttachedService } = require('./model');
    node.attachedServices = node.attachedServices || [];
    node.attachedServices.push(createAttachedService('Custom', { status: 'Configured', scope: 'Specify scope' }));
    node.expanded = true;
    markDirty();
    render();
    renderInspector();
  });

  const labelInput = container.querySelector('#nodeLabelInput') as HTMLInputElement | null;
  const addLabelFn = () => {
    if (!labelInput || !addNodeLabel(node, labelInput.value)) return;
    labelInput.value = '';
    markDirty();
    render();
    renderInspector();
  };
  container.querySelector('#addNodeLabel')?.addEventListener('click', addLabelFn);
  labelInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addLabelFn(); }
    if (e.key === 'Escape') labelInput.value = '';
  });
  container.querySelectorAll('.remove-node-label').forEach((btn) => {
    const button = btn as HTMLButtonElement;
    button.addEventListener('click', () => {
      removeNodeLabel(node, button.dataset.label || '');
      app.activeLabels = app.activeLabels.filter((l) => getNodeLabels(node).includes(l));
      markDirty();
      render();
      renderInspector();
    });
  });

  container.querySelectorAll('.attached-service-editor').forEach((editor) => {
    const el = editor as HTMLElement;
    const svc = node.attachedServices.find((s) => s.id === el.dataset.serviceId);
    if (!svc) return;
    el.querySelector('[data-key="service.name"]')?.addEventListener('change', (e) => {
      svc.name = String((e.target as HTMLInputElement).value ?? '');
      markDirty(); render(); renderInspector();
    });
    ['status', 'scope', 'protocol', 'port', 'notes'].forEach((key) => {
      el.querySelector(`[data-key="service.${key}"]`)?.addEventListener('change', (e) => {
        (svc as any)[key] = String((e.target as HTMLInputElement).value ?? '');
        markDirty(); render(); renderInspector();
      });
    });
    el.querySelector('.delete-service')?.addEventListener('click', () => {
      node.attachedServices = node.attachedServices.filter((s) => s.id !== svc.id);
      markDirty(); render(); renderInspector();
    });
  });

  container.querySelectorAll('.custom-detail-editor').forEach((editor) => {
    const el = editor as HTMLElement;
    const detail = node.customDetails.find((d) => d.id === el.dataset.detailId);
    if (!detail) return;
    el.querySelector('[data-key="detail.title"]')?.addEventListener('change', (e) => {
      detail.title = String((e.target as HTMLInputElement).value);
      markDirty(); render(); renderInspector();
    });
    el.querySelector('[data-key="detail.text"]')?.addEventListener('change', (e) => {
      detail.text = String((e.target as HTMLTextAreaElement).value);
      markDirty(); render(); renderInspector();
    });
    el.querySelector('[data-key="detail.chips"]')?.addEventListener('change', (e) => {
      detail.chips = (e.target as HTMLInputElement).value.split(',').map((s) => s.trim()).filter(Boolean);
      markDirty(); render(); renderInspector();
    });
    el.querySelector('.delete-detail')?.addEventListener('click', () => {
      node.customDetails = node.customDetails.filter((d) => d.id !== detail.id);
      markDirty(); render(); renderInspector();
    });
  });

  container.querySelector('#addNat')?.addEventListener('click', () => {
    (node.props.natRules = node.props.natRules || []).push({ name: 'New NAT', publicPort: '443', protocol: 'TCP', target: '10.10.20.10:443' });
    markDirty(); render(); renderInspector();
  });

  container.querySelector('#addRule')?.addEventListener('click', () => {
    (node.props.firewallRules = node.props.firewallRules || []).push({ name: 'New Rule', source: 'Any', destination: 'Any', service: 'Any', action: 'Allow' });
    markDirty(); render(); renderInspector();
  });
}

function renderConnectionInspector(container: HTMLElement, connection: Connection | undefined): void {
  if (!connection) return;
  const fromNode = getNode(connection.from);
  const toNode = getNode(connection.to);

  container.innerHTML = `
    <h3 class="inspector-title">Connection</h3>
    <div class="muted connection-path">${escapeHtml(fromNode?.name || '')} \u2192 ${escapeHtml(toNode?.name || '')}</div>
    <div class="field"><label>Type</label><select id="connectionKind">
      ${['network', 'replication', 'dependency', 'sync', 'vpn'].map((k) => `<option value="${k}">${formatKey(k)}</option>`).join('')}
    </select></div>
    ${fieldHtml('Label', 'label', connection.label || 'Connection')}
    ${fieldHtml('Protocol', 'protocol', connection.protocol || '')}
    ${fieldHtml('Port', 'port', connection.port || '')}
    ${fieldHtml('Schedule', 'schedule', connection.schedule || '')}
    ${fieldHtml('Direction', 'direction', connection.direction || '')}
    ${textareaHtml('Notes', 'notes', connection.notes || '')}
    <label class="check-row"><input id="connectionCollapsed" type="checkbox" ${connection.collapsed ? 'checked' : ''}> Collapse branch from this connection</label>
    <div class="muted section-help">Collapsing hides the target and everything downstream until expanded again. The connection remains visible up to its midpoint.</div>
    <div class="actions"><button id="deleteConnection" class="danger">Delete connection</button></div>`;

  const kindEl = $('connectionKind') as HTMLSelectElement;
  kindEl.value = connection.kind;
  kindEl.addEventListener('change', (e) => {
    connection.kind = (e.target as HTMLSelectElement).value;
    markDirty(); render();
  });

  container.querySelectorAll('[data-key]').forEach((field) => {
    const el = field as HTMLInputElement;
    if (el.dataset.key!.startsWith('detail.')) return;
    el.addEventListener('change', () => {
      (connection as any)[el.dataset.key!] = el.value;
      markDirty(); render();
    });
  });

  container.querySelector('#connectionCollapsed')?.addEventListener('change', (e) => {
    connection.collapsed = (e.target as HTMLInputElement).checked;
    markDirty(); render();
  });

  container.querySelector('#deleteConnection')?.addEventListener('click', () => {
    app.model.connections = app.model.connections.filter((c) => c.id !== connection.id);
    app.selected = null;
    markDirty();
    render();
    renderInspector();
  });
}
