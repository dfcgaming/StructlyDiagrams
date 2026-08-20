import { TYPES } from './types';
import { app } from './state';
import { addNode, removeNode, clearSelection, normalizeModel, markDirty } from './model';
import { resetModel } from './state';
import { render, renderInspector, toast, getWorldPoint } from './rendering';
import { fitToCanvas, autoLayout } from './layout';
import { downloadJson, loadJsonFile, loadLargeExample, exportSvg, exportPng, openTextDialog } from './io';

const $ = (id: string) => document.getElementById(id)!;

export function buildPalette(): void {
  const groups: Record<string, string[]> = {
    network: ['internet', 'publicIp', 'router', 'switch', 'vlan', 'gateway', 'subnet'],
    systems: ['server', 'vm', 'hypervisor', 'storage', 'backup', 'endpoint'],
    identity: ['ad', 'dc', 'entra', 'sync', 'm365'],
    service: ['firewall', 'vpn', 'dns', 'dhcp', 'service']
  };

  Object.entries(groups).forEach(([group, types]) => {
    const container = $(group === 'network' ? 'networkPalette' : group === 'systems' ? 'systemsPalette' : group === 'identity' ? 'identityPalette' : 'servicePalette');
    container.innerHTML = '';
    types.forEach((type) => {
      const definition = TYPES[type];
      const item = document.createElement('div');
      item.className = 'palette-item';
      item.draggable = true;
      item.dataset.type = type;
      item.innerHTML = `<div class="ico" style="background:${definition.color}33">${definition.icon}</div><div class="palette-copy"><b>${definition.label}</b><span>${definition.desc}</span></div>`;
      item.addEventListener('dragstart', (e) => e.dataTransfer!.setData('text/plain', type));
      item.addEventListener('dblclick', () => {
        addNode(type, 220 - app.model.viewport.x / app.model.viewport.scale, 160 - app.model.viewport.y / app.model.viewport.scale);
        render();
        renderInspector();
        toast(`${definition.label} added`);
      });
      container.appendChild(item);
    });
  });
}

export function bindCanvasEvents(): void {
  const canvasWrap = $('canvasWrap');

  canvasWrap.addEventListener('dragover', (e) => e.preventDefault());
  canvasWrap.addEventListener('drop', (e) => {
    e.preventDefault();
    const type = e.dataTransfer!.getData('text/plain');
    if (!TYPES[type]) return;
    const point = getWorldPoint(e.clientX, e.clientY);
    addNode(type, point.x - 95, point.y - 40);
    render();
    renderInspector();
    toast(`${TYPES[type].label} added`);
  });

  canvasWrap.addEventListener('mousedown', (e) => {
    if ((e.target as HTMLElement).closest('.node') || (e.target as HTMLElement).closest('.edge') || (e.target as HTMLElement).closest('#selectionBox')) return;
    if (e.button === 1) {
      startPan(e);
      return;
    }
    if (e.button === 0) {
      if (e.shiftKey) startPan(e);
      else startMarquee(e);
    }
  });

  canvasWrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = $('canvas').getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldX = (mouseX - app.model.viewport.x) / app.model.viewport.scale;
    const worldY = (mouseY - app.model.viewport.y) / app.model.viewport.scale;
    const nextScale = Math.max(0.3, Math.min(2.2, app.model.viewport.scale * (e.deltaY < 0 ? 1.08 : 0.92)));
    app.model.viewport.scale = nextScale;
    app.model.viewport.x = mouseX - worldX * nextScale;
    app.model.viewport.y = mouseY - worldY * nextScale;
    render();
  }, { passive: false });

  canvasWrap.addEventListener('dblclick', (e) => {
    if ((e.target as HTMLElement).closest('.node') || (e.target as HTMLElement).closest('.edge')) return;
    const point = getWorldPoint(e.clientX, e.clientY);
    addNode('service', point.x - 95, point.y - 40);
    render();
    renderInspector();
    toast('Service added');
  });
}

export function bindToolbarEvents(): void {
  $('newBtn').onclick = () => openTextDialog('New project', 'Project name', 'Untitled Infrastructure', (name) => {
    resetModel(name || 'Untitled Infrastructure');
    localStorage.removeItem('it-sketch-draft');
    render();
    renderInspector();
    toast('New project created');
  });

  $('saveBtn').onclick = downloadJson;
  $('loadBtn').onclick = () => $('fileInput').click();
  $('exampleBtn').onclick = loadLargeExample;
  $('fileInput').addEventListener('change', (e) => {
    loadJsonFile((e.target as HTMLInputElement).files?.[0]);
    (e.target as HTMLInputElement).value = '';
  });
  $('autoBtn').onclick = autoLayout;
  $('fitBtn').onclick = fitToCanvas;
  $('expandBtn').onclick = () => { app.model.nodes.forEach((n) => n.expanded = true); markDirty(); render(); };
  $('collapseBtn').onclick = () => { app.model.nodes.forEach((n) => n.expanded = false); markDirty(); render(); };
  $('connectionsBtn').onclick = () => {
    app.connectionsVisible = !app.connectionsVisible;
    $('connectionsBtn').textContent = `Connections: ${app.connectionsVisible ? 'On' : 'Off'}`;
    render();
    toast(app.connectionsVisible ? 'Connections shown' : 'Connections hidden');
  };
  $('svgBtn').onclick = exportSvg;
  $('pngBtn').onclick = exportPng;
}

export function bindKeyboardEvents(): void {
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      downloadJson();
    }

    if (e.key === 'Escape') {
      app.connectDrag = null;
      render();
    }

    if (e.key === 'Delete' && app.selected) {
      if (app.selected.kind === 'node') {
        removeNode(app.selected.id as string);
        render();
        renderInspector();
      } else if (app.selected.kind === 'nodes') {
        const ids = new Set(app.multiSelected);
        app.model.nodes = app.model.nodes.filter((n) => !ids.has(n.id));
        app.model.connections = app.model.connections.filter((c) => !ids.has(c.from) && !ids.has(c.to));
        clearSelection();
        markDirty();
        render();
        renderInspector();
      } else if (app.selected.kind === 'connection') {
        app.model.connections = app.model.connections.filter((c) => c.id !== app.selected!.id);
        app.selected = null;
        markDirty();
        render();
        renderInspector();
      }
    }
  });
}

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
