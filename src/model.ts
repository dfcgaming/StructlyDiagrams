import {
  InfraModel, InfraNode, Connection, AttachedService, CustomDetail, AppSelection,
  GRID_SIZE, NODE_MIN_WIDTH, TYPES, TEMPLATES
} from './types';
import { app } from './state';

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36).slice(-5)}`;
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function snap(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

export function getNode(id: string): InfraNode | undefined {
  return app.model.nodes.find((n) => n.id === id);
}

export function getConnection(id: string): Connection | undefined {
  return app.model.connections.find((c) => c.id === id);
}

export function markDirty(): void {
  app.dirty = true;
  app.model.project.updated = new Date().toISOString();
  persistDraft();
  document.getElementById('status')!.textContent = 'Unsaved changes';
}

export function selectItem(kind: NonNullable<AppSelection>['kind'], id: string | string[]): void {
  app.selected = { kind, id };
  app.connectDrag = null;
  app.multiSelected.clear();
  if (kind === 'node' && typeof id === 'string') app.multiSelected.add(id);
}

export function toggleNodeSelection(nodeId: string): void {
  if (app.multiSelected.has(nodeId)) app.multiSelected.delete(nodeId);
  else app.multiSelected.add(nodeId);

  const ids = [...app.multiSelected];
  if (ids.length === 1) app.selected = { kind: 'node', id: ids[0] };
  else if (ids.length > 1) app.selected = { kind: 'nodes', id: ids };
  else app.selected = null;
}

export function clearSelection(): void {
  app.selected = null;
  app.multiSelected.clear();
}

export function createAttachedService(name: string, options: Partial<Pick<AttachedService, 'status' | 'scope' | 'protocol' | 'port' | 'notes'>> = {}): AttachedService {
  return {
    id: uid('svc'),
    name: String(name || 'Custom'),
    status: String(options.status || 'Configured'),
    scope: String(options.scope || 'Unspecified'),
    protocol: String(options.protocol || ''),
    port: String(options.port || ''),
    notes: String(options.notes || '')
  };
}

export function getDefaultAttachedServices(type: string, props: Record<string, unknown> = {}): AttachedService[] {
  const defaults: Record<string, AttachedService[]> = {
    firewall: [
      createAttachedService('DNS', { status: props.dns ? 'Enabled' : 'Disabled', scope: 'Firewall / resolver' }),
      createAttachedService('VPN', { status: props.vpn ? 'Enabled' : 'Disabled', scope: 'Site-to-site / remote access' }),
      createAttachedService('NAT', { status: 'Configured', scope: 'Public IP / port forwards' }),
      createAttachedService('Firewall', { status: 'Configured', scope: 'WAN / LAN policy' })
    ],
    ad: [createAttachedService('AD DS', { status: 'Provided', scope: 'Domain services' }), createAttachedService('DNS', { status: 'Provided', scope: 'Domain DNS' })],
    dc: [createAttachedService('AD DS', { status: 'Running', scope: 'Domain Controller' }), createAttachedService('DNS', { status: 'Running', scope: 'Domain DNS' }), createAttachedService('Kerberos', { status: 'Running', scope: 'Domain authentication' })],
    m365: [createAttachedService('Exchange', { status: 'Cloud', scope: 'Microsoft 365 tenant' }), createAttachedService('Teams', { status: 'Cloud', scope: 'Microsoft 365 tenant' })]
  };
  return clone(defaults[type] || []);
}

export function normalizeAttachedService(service: Partial<AttachedService> = {}): AttachedService {
  return {
    id: service.id || uid('svc'),
    name: String(service.name ?? 'Custom'),
    status: String(service.status ?? 'Configured'),
    scope: String(service.scope ?? 'Unspecified'),
    protocol: String(service.protocol ?? ''),
    port: String(service.port ?? ''),
    notes: String(service.notes ?? '')
  };
}

export function normalizeCustomDetail(detail: Partial<CustomDetail> = {}): CustomDetail {
  return {
    id: detail.id || uid('detail'),
    title: String(detail.title ?? 'Note'),
    text: String(detail.text ?? ''),
    chips: Array.isArray(detail.chips) ? detail.chips.map(String) : []
  };
}

export function normalizeConnection(connection: Partial<Connection> = {}): Connection {
  return {
    id: connection.id || uid('con'),
    from: connection.from || '',
    to: connection.to || '',
    fromPort: connection.fromPort || 'out',
    toPort: connection.toPort || 'in',
    kind: connection.kind || 'network',
    label: connection.label || 'Connection',
    protocol: connection.protocol || '',
    port: connection.port || '',
    schedule: connection.schedule || '',
    direction: connection.direction || '',
    notes: connection.notes || '',
    collapsed: Boolean(connection.collapsed)
  };
}

function migrateLegacyServices(rawNode: Record<string, unknown>, baseNode: InfraNode): AttachedService[] {
  const services = Array.isArray(baseNode.attachedServices) ? clone(baseNode.attachedServices) : [];
  const props = rawNode.props as Record<string, unknown> | undefined;
  if (rawNode.type === 'firewall' && props) {
    if (props.dhcp === true) services.push(createAttachedService('DHCP', { status: 'Enabled', scope: 'Define specific VLAN / subnet' }));
    if (props.dns === true && !services.some((s) => s.name === 'DNS')) services.push(createAttachedService('DNS', { status: 'Enabled', scope: 'Firewall / resolver' }));
    if (props.vpn === true && !services.some((s) => s.name === 'VPN')) services.push(createAttachedService('VPN', { status: 'Enabled', scope: 'Site-to-site / remote access' }));
  }
  return services.map(normalizeAttachedService);
}

export function createBaseNode(type: string, x: number, y: number): InfraNode {
  const definition = TYPES[type] || TYPES.service;
  const node: InfraNode = {
    id: uid(type),
    type,
    name: definition.label,
    description: definition.desc,
    x, y,
    w: NODE_MIN_WIDTH,
    h: 80,
    expanded: false,
    props: {},
    attachedServices: [],
    customDetails: [],
    labels: []
  };

  const propsMap: Record<string, unknown> = {
    publicIp: { address: '203.0.113.10', label: 'Public WAN IP' },
    vlan: { id: '10', name: 'Servers', subnet: '10.10.20.0/24', gateway: '10.10.20.1' },
    gateway: { address: '10.10.20.1', vlan: '10' },
    subnet: { cidr: '10.10.20.0/24' },
    firewall: { model: 'XGS 136', serial: '', wan: ['203.0.113.10'], lan: ['10.10.0.1'], dhcp: false, dns: true, vpn: true, natRules: [{ name: 'HTTPS Web', publicPort: '443', protocol: 'TCP', target: '10.10.20.15:443' }], firewallRules: [{ name: 'LAN to Internet', source: 'LAN', destination: 'Any', service: 'Any', action: 'Allow' }] },
    ad: { domain: 'corp.example.local', site: 'HQ', functionalLevel: '2019' },
    dc: { hostname: 'DC01', ip: '10.10.20.11', roles: ['AD DS', 'DNS'], site: 'HQ' },
    sync: { status: 'Healthy', scope: 'Users, Groups', lastSync: 'Just now' },
    m365: { tenant: 'contoso.onmicrosoft.com', users: '250', services: ['Exchange Online', 'Teams', 'SharePoint Online', 'OneDrive', 'Intune', 'Defender'] },
    server: { hostname: 'APP01', ip: '10.10.20.15', os: 'Windows Server 2022' },
    vm: { name: 'VM01', ip: '10.10.20.25', host: 'HV01', os: 'Windows Server 2022' },
    endpoint: { hostname: 'PC-001', ip: '10.10.30.21', user: 'user@example.com' },
    dns: { host: 'DNS01', ip: '10.10.20.11' },
    dhcp: { scope: '10.10.30.0/24', gateway: '10.10.30.1', dns: '10.10.20.11' },
    service: { service: 'HTTPS', port: '443', protocol: 'TCP' },
    vpn: { kind: 'Site-to-site', remote: 'Branch A', status: 'Up' }
  };

  const props = propsMap[type];
  node.props = props ? clone(props as Record<string, unknown>) as any : {} as any;
  node.labels = (TEMPLATES[type] || []).slice();
  node.attachedServices = getDefaultAttachedServices(type, node.props);
  return node;
}

export function normalizeModel(data: Partial<InfraModel>): InfraModel {
  const normalized: InfraModel = {
    version: 3,
    project: { name: 'Untitled Infrastructure', updated: new Date().toISOString() },
    nodes: [],
    connections: [],
    viewport: { x: 0, y: 0, scale: 1 }
  };
  normalized.version = Number(data?.version || 3);
  normalized.project = { ...normalized.project, ...(data?.project || {}) };
  normalized.nodes = Array.isArray(data?.nodes) ? data.nodes.map((raw: any) => {
    const base = createBaseNode(raw.type || 'service', Number(raw.x) || 100, Number(raw.y) || 100);
    return {
      ...base,
      ...raw,
      w: NODE_MIN_WIDTH,
      h: 80,
      props: raw.props || base.props || {},
      attachedServices: Array.isArray(raw.attachedServices)
        ? raw.attachedServices.map(normalizeAttachedService)
        : migrateLegacyServices(raw, base),
      customDetails: Array.isArray(raw.customDetails)
        ? raw.customDetails.map(normalizeCustomDetail)
        : [],
      labels: Array.isArray(raw.labels)
        ? raw.labels.map(String).filter(Boolean)
        : (base.labels || []).slice()
    };
  }) : [];
  normalized.connections = Array.isArray(data?.connections)
    ? data.connections.map(normalizeConnection)
    : [];
  normalized.viewport = { ...normalized.viewport, ...(data?.viewport || {}) };
  return normalized;
}

export function addNode(type: string, x = 220, y = 160): InfraNode {
  const node = createBaseNode(type, snap(x), snap(y));
  app.model.nodes.push(node);
  app.selected = { kind: 'node', id: node.id };
  markDirty();
  return node;
}

export function removeNode(id: string): void {
  app.model.nodes = app.model.nodes.filter((n) => n.id !== id);
  app.model.connections = app.model.connections.filter((c) => c.from !== id && c.to !== id);
  app.multiSelected.delete(id);
  if (app.selected?.id === id || app.selected?.kind === 'nodes') {
    const ids = [...app.multiSelected];
    app.selected = ids.length
      ? (ids.length === 1 ? { kind: 'node', id: ids[0] } : { kind: 'nodes', id: ids })
      : null;
  }
  markDirty();
}

export function toggleExpanded(id: string): void {
  const node = getNode(id);
  if (!node) return;
  node.expanded = !node.expanded;
  markDirty();
}

export function createDetail(title = 'Note', text = '', chips: string[] = []): CustomDetail {
  return normalizeCustomDetail({ title, text, chips });
}

export function persistDraft(): void {
  try { localStorage.setItem('it-sketch-draft', JSON.stringify(app.model)); } catch { /* ignore */ }
}

export function restoreDraft(): void {
  try {
    const raw = localStorage.getItem('it-sketch-draft');
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data?.nodes || data?.project) app.model = normalizeModel(data);
  } catch { /* ignore */ }
}
