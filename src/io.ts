import { InfraModel, TYPES } from './types';
import { app, resetModel } from './state';
import { normalizeModel, markDirty, persistDraft, restoreDraft } from './model';
import { escapeHtml, render, renderInspector, toast } from './rendering';

const $ = (id: string) => document.getElementById(id)!;

export function downloadJson(): void {
  const blob = new Blob([JSON.stringify(app.model, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${(app.model.project.name || 'infrastructure').replace(/[^a-z0-9_-]+/gi, '_') || 'infrastructure'}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  app.dirty = false;
  persistDraft();
  $('status').textContent = 'Saved';
  toast('Saved JSON');
}

export function loadJsonFile(file: File | undefined): void {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      app.model = normalizeModel(JSON.parse(reader.result as string));
      app.selected = null;
      app.activeLabels = [];
      app.dirty = false;
      render();
      renderInspector();
      toast('JSON loaded');
    } catch (error: any) {
      alert(`Could not load JSON: ${error.message}`);
    }
  };
  reader.readAsText(file);
}

export function loadLargeExample(): void {
  app.model = normalizeModel(LARGE_EXAMPLE_MODEL);
  app.selected = null;
  app.multiSelected.clear();
  app.activeLabels = [];
  app.dirty = false;
  render();
  renderInspector();
  toast('Large example loaded');
}

function escapeXml(value: unknown): string {
  return String(value).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] || c));
}

export function buildExportSvg(): { svg: string; width: number; height: number } {
  const { measureAllNodes: measure } = require('./rendering');
  const { buildEdgePath, getExpandedDetails } = require('./rendering');
  measure();

  const minX = Math.min(0, ...app.model.nodes.map((n) => n.x));
  const minY = Math.min(0, ...app.model.nodes.map((n) => n.y));
  const maxX = Math.max(900, ...app.model.nodes.map((n) => n.x + n.w + 120));
  const maxY = Math.max(650, ...app.model.nodes.map((n) => n.y + n.h + 120));
  const width = maxX - minX;
  const height = maxY - minY;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${minX} ${minY} ${width} ${height}">`;
  svg += '<rect width="100%" height="100%" fill="#0b1118"/>';

  app.model.connections.forEach((conn: any) => {
    const fromNode = app.model.nodes.find((n: any) => n.id === conn.from);
    const toNode = app.model.nodes.find((n: any) => n.id === conn.to);
    if (!fromNode || !toNode) return;
    if (!app.connectionsVisible) return;
    if (conn.collapsed) return;

    const path = buildEdgePath(fromNode, toNode, conn.fromPort, conn.toPort);
    const stroke = conn.kind === 'replication' ? '#b38bff' : '#6f89a3';
    const dash = conn.kind === 'replication' ? ' stroke-dasharray="8 6"' : '';
    svg += `<path d="${path}" fill="none" stroke="${stroke}" stroke-width="2"${dash}/>`;
  });

  app.model.nodes.forEach((node: any) => {
    const definition = TYPES[node.type] || TYPES.service;
    const labels = Array.isArray(node.labels) ? node.labels : [];
    const childDetails = node.expanded ? getExpandedDetails(node) : [];

    const paddingX = 10;
    const titleX = 48;
    const titleY = 24;
    const descY = 40;
    let extraY = 56;
    let nodeSvg = `<g transform="translate(${node.x} ${node.y})">`;
    nodeSvg += `<rect width="${node.w}" height="${node.h}" rx="10" fill="#172330" stroke="#3b4f66"/>`;
    nodeSvg += `<rect x="10" y="10" width="28" height="28" rx="7" fill="${escapeXml(definition.color || '#44566a')}"/>`;
    nodeSvg += `<text x="24" y="29" text-anchor="middle" fill="#fff" font-size="12" font-family="Segoe UI,Arial">${escapeXml(definition.icon || '\u2022')}</text>`;
    nodeSvg += `<text x="${titleX}" y="${titleY}" fill="#e9f0f7" font-size="12" font-weight="700" font-family="Segoe UI,Arial">${escapeXml(node.name || definition.label)}</text>`;
    nodeSvg += `<text x="${titleX}" y="${descY}" fill="#8fa1b5" font-size="9" font-family="Segoe UI,Arial">${escapeXml(node.description || definition.desc || '')}</text>`;

    if (labels.length) {
      labels.forEach((label: string, i: number) => {
        const chipWidth = Math.min(130, Math.max(34, 10 + String(label).length * 5.5));
        const chipX = paddingX + (i * (chipWidth + 4));
        nodeSvg += `<rect x="${chipX}" y="${extraY}" width="${chipWidth}" height="18" rx="9" fill="#162230" stroke="#33465d"/>`;
        nodeSvg += `<text x="${chipX + chipWidth / 2}" y="${extraY + 12}" text-anchor="middle" fill="#bdd1e3" font-size="9" font-family="Segoe UI,Arial">${escapeXml(label)}</text>`;
      });
      extraY += 24;
    }

    childDetails.forEach((detail: any) => {
      nodeSvg += `<line x1="${paddingX}" y1="${extraY}" x2="${node.w - paddingX}" y2="${extraY}" stroke="#2a394b"/>`;
      extraY += 6;
      nodeSvg += `<text x="${paddingX}" y="${extraY + 10}" fill="#dce8f3" font-size="10" font-weight="700" font-family="Segoe UI,Arial">${escapeXml(detail.title || 'Detail')}</text>`;
      extraY += 16;
      if (detail.text) {
        nodeSvg += `<text x="${paddingX}" y="${extraY}" fill="#8fa1b5" font-size="9" font-family="Segoe UI,Arial">${escapeXml(detail.text)}</text>`;
        extraY += 13;
      }
    });

    nodeSvg += '</g>';
    svg += nodeSvg;
  });

  svg += '</svg>';
  return { svg, width, height };
}

export function exportSvg(): void {
  const { svg } = buildExportSvg();
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${(app.model.project.name || 'infrastructure').replace(/[^a-z0-9_-]+/gi, '_') || 'infrastructure'}.svg`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function exportPng(): void {
  const { svg, width, height } = buildExportSvg();
  const scale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    toast('PNG export is not supported by this browser');
    return;
  }

  const image = new Image();
  image.onload = () => {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.drawImage(image, 0, 0, width, height);
    canvas.toBlob((blob) => {
      if (!blob) { toast('Could not create PNG'); return; }
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${(app.model.project.name || 'infrastructure').replace(/[^a-z0-9_-]+/gi, '_') || 'infrastructure'}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }, 'image/png');
  };
  image.onerror = () => toast('Could not render PNG export');
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function openTextDialog(title: string, label: string, value: string, callback: (value: string) => void): void {
  $('dialogTitle').textContent = title;
  $('dialogBody').innerHTML = `<div class="field"><label>${escapeHtml(label)}</label><input id="dialogInput" value="${escapeHtml(value || '')}"></div>`;
  $('dialogBackdrop').classList.add('show');
  const input = $('dialogInput') as HTMLInputElement;
  input.focus();
  input.select();

  const close = () => $('dialogBackdrop').classList.remove('show');
  $('dialogCancel').onclick = close;
  $('dialogOk').onclick = () => { const v = input.value; close(); callback(v); };
  input.onkeydown = (e) => {
    if (e.key === 'Enter') ($('dialogOk') as HTMLButtonElement).click();
    if (e.key === 'Escape') close();
  };
}

/* ============================================================
   LARGE EXAMPLE MODEL
   ============================================================ */

const LARGE_EXAMPLE_MODEL: Partial<InfraModel> = {
  version: 3,
  project: { name: 'Mega Enterprise Example', updated: '2026-08-18T09:00:00.000Z' },
  nodes: [
    { id: 'ex_001', type: 'internet', name: 'Internet / ISP Edge', x: 80, y: 80, w: 220, h: 96, expanded: true, props: { provider: 'ExampleNet', asn: 'AS64500', circuit: '2 Gbps' } as any, attachedServices: [{ id: 'svc_0', name: 'Monitoring', status: 'Configured', scope: 'WAN', protocol: '', port: '', notes: '' }], customDetails: [{ id: 'd_0', title: 'Notes', text: 'Redundant public edge for this large example.', chips: ['Redundant', '2 Gbps'] }], labels: ['WAN', 'Public', 'Internet'] },
    { id: 'ex_002', type: 'firewall', name: 'Sophos XGS 4500', x: 360, y: 80, w: 220, h: 96, expanded: true, props: { model: 'XGS 4500', serial: 'LAB-XGS-001', wan: ['203.0.113.10'], lan: ['10.10.0.1'], dhcp: false, dns: true, vpn: true } as any, attachedServices: [{ id: 'svc_1', name: 'DNS', status: 'Enabled', scope: 'Firewall resolver', protocol: '', port: '', notes: '' }, { id: 'svc_2', name: 'NAT', status: 'Configured', scope: 'Public IP / port forwards', protocol: '', port: '', notes: '' }, { id: 'svc_3', name: 'VPN', status: 'Enabled', scope: 'Remote access / site-to-site', protocol: '', port: '', notes: '' }, { id: 'svc_4', name: 'Firewall', status: 'Configured', scope: 'WAN / LAN policy', protocol: '', port: '', notes: '' }], customDetails: [{ id: 'd_1', title: 'HA', text: 'Primary member of HA cluster', chips: ['A/P', 'Critical'] }], labels: ['Firewall', 'Production', 'HA', 'WAN'] },
    { id: 'ex_003', type: 'switch', name: 'Core Switch Stack', x: 680, y: 190, w: 220, h: 96, expanded: true, props: { model: 'Catalyst 9500', members: '2', mgmt: '10.10.10.2' } as any, attachedServices: [{ id: 'svc_5', name: 'Monitoring', status: 'Enabled', scope: 'SNMP / telemetry', protocol: '', port: '', notes: '' }, { id: 'svc_6', name: 'NTP', status: 'Enabled', scope: 'Time sync', protocol: '', port: '', notes: '' }], customDetails: [], labels: ['Network', 'Core', 'L2'] },
    { id: 'ex_004', type: 'vlan', name: 'VLAN 10 - Servers', x: 960, y: 80, w: 220, h: 96, expanded: false, props: { id: '10', name: 'Servers', subnet: '10.10.20.0/24', gateway: '10.10.20.1' } as any, attachedServices: [], customDetails: [], labels: ['VLAN', 'Servers'] },
    { id: 'ex_005', type: 'vlan', name: 'VLAN 20 - Workstations', x: 960, y: 260, w: 220, h: 96, expanded: false, props: { id: '20', name: 'Workstations', subnet: '10.10.30.0/24', gateway: '10.10.30.1' } as any, attachedServices: [], customDetails: [], labels: ['VLAN', 'Clients'] },
    { id: 'ex_006', type: 'server', name: 'DC01', x: 1240, y: 80, w: 220, h: 96, expanded: true, props: { hostname: 'DC01', ip: '10.10.20.11', os: 'Windows Server 2022' } as any, attachedServices: [{ id: 'svc_7', name: 'AD DS', status: 'Running', scope: 'Domain Controller', protocol: '', port: '', notes: '' }, { id: 'svc_8', name: 'DNS', status: 'Running', scope: 'Domain DNS', protocol: '', port: '', notes: '' }, { id: 'svc_9', name: 'Kerberos', status: 'Running', scope: 'Domain authentication', protocol: '', port: '', notes: '' }], customDetails: [{ id: 'd_2', title: 'Roles', text: 'AD DS, DNS, DHCP, FSMO (PDC Emulator)', chips: ['Critical', 'FSMO'] }], labels: ['Server', 'Domain Controller', 'Critical'] },
    { id: 'ex_007', type: 'server', name: 'APP01', x: 1240, y: 260, w: 220, h: 96, expanded: false, props: { hostname: 'APP01', ip: '10.10.20.15', os: 'Windows Server 2022' } as any, attachedServices: [{ id: 'svc_10', name: 'HTTPS', status: 'Enabled', scope: 'Web application', protocol: 'TCP', port: '443', notes: '' }], customDetails: [], labels: ['Server', 'Application'] },
    { id: 'ex_008', type: 'server', name: 'DB01', x: 1240, y: 440, w: 220, h: 96, expanded: false, props: { hostname: 'DB01', ip: '10.10.20.20', os: 'Windows Server 2022' } as any, attachedServices: [{ id: 'svc_11', name: 'SQL', status: 'Running', scope: 'Database', protocol: 'TCP', port: '1433', notes: '' }], customDetails: [], labels: ['Server', 'Database'] },
    { id: 'ex_009', type: 'storage', name: 'NAS01', x: 1240, y: 620, w: 220, h: 96, expanded: false, props: { capacity: '20 TB', protocol: 'SMB / NFS' } as any, attachedServices: [{ id: 'svc_12', name: 'Backup', status: 'Configured', scope: 'File share', protocol: '', port: '', notes: '' }], customDetails: [], labels: ['Storage', 'Backup'] },
    { id: 'ex_010', type: 'ad', name: 'Active Directory', x: 1520, y: 80, w: 220, h: 96, expanded: true, props: { domain: 'corp.example.local', site: 'HQ', functionalLevel: '2019' } as any, attachedServices: [{ id: 'svc_13', name: 'AD DS', status: 'Provided', scope: 'Domain services', protocol: '', port: '', notes: '' }, { id: 'svc_14', name: 'DNS', status: 'Provided', scope: 'Domain DNS', protocol: '', port: '', notes: '' }], customDetails: [{ id: 'd_3', title: 'Forest', text: 'Single forest, single domain', chips: ['Forest', 'HQ'] }], labels: ['Identity', 'Active Directory'] },
    { id: 'ex_011', type: 'm365', name: 'Microsoft 365', x: 1520, y: 260, w: 220, h: 96, expanded: true, props: { tenant: 'contoso.onmicrosoft.com', users: '500', services: ['Exchange Online', 'Teams', 'SharePoint Online', 'OneDrive', 'Intune', 'Defender'] } as any, attachedServices: [{ id: 'svc_15', name: 'Exchange', status: 'Cloud', scope: 'Microsoft 365 tenant', protocol: '', port: '', notes: '' }, { id: 'svc_16', name: 'Teams', status: 'Cloud', scope: 'Microsoft 365 tenant', protocol: '', port: '', notes: '' }], customDetails: [], labels: ['Cloud', 'Microsoft 365'] },
    { id: 'ex_012', type: 'endpoint', name: 'Workstations', x: 1520, y: 440, w: 220, h: 96, expanded: false, props: { count: '200', os: 'Windows 11', management: 'Intune' } as any, attachedServices: [{ id: 'svc_17', name: 'EDR', status: 'Enabled', scope: 'All endpoints', protocol: '', port: '', notes: '' }], customDetails: [], labels: ['Client', 'Intune'] },
    { id: 'ex_013', type: 'vpn', name: 'Site-to-Site VPN', x: 360, y: 440, w: 220, h: 96, expanded: false, props: { kind: 'Site-to-site', remote: 'Branch Office', status: 'Up' } as any, attachedServices: [{ id: 'svc_18', name: 'VPN', status: 'Enabled', scope: 'Branch connectivity', protocol: 'IPSec', port: '', notes: '' }], customDetails: [], labels: ['VPN', 'Branch'] }
  ],
  connections: [
    { id: 'conn_001', from: 'ex_001', to: 'ex_002', fromPort: 'out', toPort: 'in', kind: 'network', label: 'WAN', protocol: '', port: '', schedule: '', direction: '', notes: '', collapsed: false },
    { id: 'conn_002', from: 'ex_002', to: 'ex_003', fromPort: 'out', toPort: 'in', kind: 'network', label: 'LAN', protocol: '', port: '', schedule: '', direction: '', notes: '', collapsed: false },
    { id: 'conn_003', from: 'ex_003', to: 'ex_004', fromPort: 'out', toPort: 'in', kind: 'network', label: 'Trunk', protocol: '', port: '', schedule: '', direction: '', notes: '', collapsed: false },
    { id: 'conn_004', from: 'ex_003', to: 'ex_005', fromPort: 'out', toPort: 'in', kind: 'network', label: 'Trunk', protocol: '', port: '', schedule: '', direction: '', notes: '', collapsed: false },
    { id: 'conn_005', from: 'ex_004', to: 'ex_006', fromPort: 'out', toPort: 'in', kind: 'network', label: 'Access', protocol: '', port: '', schedule: '', direction: '', notes: '', collapsed: false },
    { id: 'conn_006', from: 'ex_004', to: 'ex_007', fromPort: 'out', toPort: 'in', kind: 'network', label: 'Access', protocol: '', port: '', schedule: '', direction: '', notes: '', collapsed: false },
    { id: 'conn_007', from: 'ex_004', to: 'ex_008', fromPort: 'out', toPort: 'in', kind: 'network', label: 'Access', protocol: '', port: '', schedule: '', direction: '', notes: '', collapsed: false },
    { id: 'conn_008', from: 'ex_004', to: 'ex_009', fromPort: 'out', toPort: 'in', kind: 'network', label: 'Access', protocol: '', port: '', schedule: '', direction: '', notes: '', collapsed: false },
    { id: 'conn_009', from: 'ex_006', to: 'ex_010', fromPort: 'out', toPort: 'in', kind: 'sync', label: 'AD DS', protocol: '', port: '', schedule: '', direction: '', notes: '', collapsed: false },
    { id: 'conn_010', from: 'ex_010', to: 'ex_011', fromPort: 'out', toPort: 'in', kind: 'sync', label: 'Entra Connect', protocol: '', port: '', schedule: '', direction: '', notes: '', collapsed: false },
    { id: 'conn_011', from: 'ex_005', to: 'ex_012', fromPort: 'out', toPort: 'in', kind: 'network', label: 'Access', protocol: '', port: '', schedule: '', direction: '', notes: '', collapsed: false },
    { id: 'conn_012', from: 'ex_002', to: 'ex_013', fromPort: 'out', toPort: 'in', kind: 'vpn', label: 'IPSec', protocol: '', port: '', schedule: '', direction: '', notes: '', collapsed: false },
    { id: 'conn_013', from: 'ex_007', to: 'ex_008', fromPort: 'out', toPort: 'in', kind: 'dependency', label: 'DB Connection', protocol: 'TCP', port: '1433', schedule: '', direction: '', notes: '', collapsed: false }
  ],
  viewport: { x: 0, y: 0, scale: 1 }
};
