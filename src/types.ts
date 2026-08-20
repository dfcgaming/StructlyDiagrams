export interface NodeTypeDefinition {
  label: string;
  icon: string;
  cat: string;
  color: string;
  desc: string;
}

export interface NodeProps {
  [key: string]: unknown;
  model?: string;
  serial?: string;
  wan?: string[];
  lan?: string[];
  dhcp?: boolean;
  dns?: boolean;
  vpn?: boolean;
  natRules?: NatRule[];
  firewallRules?: FirewallRule[];
  domain?: string;
  site?: string;
  functionalLevel?: string;
  hostname?: string;
  ip?: string;
  roles?: string[];
  status?: string;
  scope?: string;
  lastSync?: string;
  tenant?: string;
  users?: string;
  services?: string[];
  os?: string;
  address?: string;
  id?: string;
  name?: string;
  subnet?: string;
  gateway?: string;
  cidr?: string;
  host?: string;
  service?: string;
  port?: string;
  protocol?: string;
  kind?: string;
  remote?: string;
  user?: string;
}

export interface NatRule {
  name: string;
  publicPort: string;
  protocol: string;
  target: string;
}

export interface FirewallRule {
  name: string;
  source: string;
  destination: string;
  service: string;
  action: string;
}

export interface AttachedService {
  id: string;
  name: string;
  status: string;
  scope: string;
  protocol: string;
  port: string;
  notes: string;
}

export interface CustomDetail {
  id: string;
  title: string;
  text: string;
  chips: string[];
}

export interface InfraNode {
  id: string;
  type: string;
  name: string;
  description?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  expanded: boolean;
  props: NodeProps;
  attachedServices: AttachedService[];
  customDetails: CustomDetail[];
  labels: string[];
}

export interface Connection {
  id: string;
  from: string;
  to: string;
  fromPort: string;
  toPort: string;
  kind: string;
  label: string;
  protocol: string;
  port: string;
  schedule: string;
  direction: string;
  notes: string;
  collapsed: boolean;
}

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export interface InfraModel {
  version: number;
  project: { name: string; updated: string };
  nodes: InfraNode[];
  connections: Connection[];
  viewport: Viewport;
}

export type AppSelection = {
  kind: 'node' | 'nodes' | 'connection';
  id: string | string[];
} | null;

export interface NodeDragItem {
  id: string;
  startX: number;
  startY: number;
}

export interface NodeDrag {
  startX: number;
  startY: number;
  items: NodeDragItem[];
}

export interface Pan {
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

export interface Marquee {
  startClientX: number;
  startClientY: number;
  startCanvasX: number;
  startCanvasY: number;
  additive: boolean;
}

export interface ConnectDrag {
  nodeId: string;
  port: string;
  current: { x: number; y: number };
}

export interface ExpandedDetail {
  title: string;
  text: string;
  chips: string[];
}

export const SVG_NS = 'http://www.w3.org/2000/svg';
export const STORAGE_KEY = 'it-sketch-draft';
export const GRID_SIZE = 10;
export const NODE_MIN_WIDTH = 190;
export const NODE_MAX_WIDTH = 420;
export const NODE_MIN_HEIGHT = 80;

export const TYPES: Record<string, NodeTypeDefinition> = {
  internet: { label: 'Internet', icon: '\u2601', cat: 'network', color: '#3b6382', desc: 'External network / WAN' },
  publicIp: { label: 'Public IP', icon: '\u25CE', cat: 'network', color: '#446f95', desc: 'External IP address' },
  router: { label: 'Router', icon: '\u2194', cat: 'network', color: '#496c88', desc: 'Layer 3 router' },
  switch: { label: 'Switch', icon: '\u2318', cat: 'network', color: '#465c76', desc: 'Network switch' },
  vlan: { label: 'VLAN', icon: '\u25A6', cat: 'network', color: '#555c8a', desc: 'Logical network segment' },
  gateway: { label: 'Gateway', icon: '\u21E5', cat: 'network', color: '#5a738c', desc: 'VLAN / subnet gateway' },
  subnet: { label: 'Subnet', icon: '\u25EB', cat: 'network', color: '#4f6d65', desc: 'IP subnet' },
  firewall: { label: 'Sophos Firewall', icon: '\uD83D\uDEE1', cat: 'security', color: '#6e5640', desc: 'Sophos XG / XGS firewall' },
  server: { label: 'Server', icon: '\u25A3', cat: 'systems', color: '#4d5f72', desc: 'Physical or virtual server' },
  vm: { label: 'Virtual Machine', icon: '\u25C8', cat: 'systems', color: '#4f637c', desc: 'VM guest' },
  hypervisor: { label: 'Hypervisor', icon: '\u2B21', cat: 'systems', color: '#665e82', desc: 'Hypervisor host' },
  storage: { label: 'Storage', icon: '\u25A4', cat: 'systems', color: '#536c72', desc: 'NAS / SAN / storage' },
  backup: { label: 'Backup', icon: '\u27F3', cat: 'systems', color: '#506c64', desc: 'Backup infrastructure' },
  ad: { label: 'Active Directory', icon: 'AD', cat: 'identity', color: '#5e5f8b', desc: 'On-premises directory' },
  dc: { label: 'Domain Controller', icon: 'DC', cat: 'identity', color: '#5c6f95', desc: 'AD DS domain controller' },
  entra: { label: 'Entra ID', icon: 'E', cat: 'identity', color: '#49668a', desc: 'Cloud identity' },
  sync: { label: 'Entra Connect', icon: '\u21C4', cat: 'identity', color: '#4c7080', desc: 'Directory synchronization' },
  m365: { label: 'Microsoft 365', icon: 'M', cat: 'identity', color: '#53678d', desc: 'Microsoft 365 tenant' },
  endpoint: { label: 'Endpoint', icon: '\u25A4', cat: 'systems', color: '#536474', desc: 'PC, laptop or managed endpoint' },
  dns: { label: 'DNS', icon: 'D', cat: 'service', color: '#596b82', desc: 'DNS service' },
  dhcp: { label: 'DHCP', icon: 'H', cat: 'service', color: '#5e6f74', desc: 'DHCP service' },
  service: { label: 'Service', icon: '\u2699', cat: 'service', color: '#645d72', desc: 'Generic service' },
  vpn: { label: 'VPN', icon: '\u2303', cat: 'security', color: '#596b7b', desc: 'VPN tunnel' },
};

export const SERVICE_CATALOG = [
  'DHCP', 'DNS', 'NAT', 'Firewall', 'VPN', 'HTTP', 'HTTPS', 'RDP', 'SSH', 'SMB', 'LDAP', 'Kerberos',
  'SQL', 'NTP', 'RADIUS', 'Syslog', 'Monitoring', 'Backup', 'Proxy', 'Reverse Proxy', 'WAF', 'EDR',
  'AD DS', 'Entra Connect', 'Exchange', 'Teams', 'SharePoint', 'OneDrive', 'Intune', 'Defender', 'Custom'
];

export const TEMPLATES: Record<string, string[]> = {
  internet: ['WAN'], publicIp: ['IPv4'], router: ['L3'], switch: ['L2'], vlan: ['802.1Q'],
  gateway: ['Default GW'], subnet: ['CIDR'], firewall: ['NAT', 'Firewall', 'VPN', 'DHCP'],
  server: ['OS'], vm: ['Guest'], hypervisor: ['Host'], storage: ['NAS/SAN'], backup: ['Backup'],
  ad: ['AD DS', 'DNS'], dc: ['LDAP', 'Kerberos', 'DNS', 'SYSVOL'], entra: ['Identity'], sync: ['Sync'],
  m365: ['Exchange', 'Teams', 'SharePoint'], endpoint: ['Client'], dns: ['53/TCP/UDP'],
  dhcp: ['67/68'], service: ['TCP/UDP'], vpn: ['Tunnel']
};

export const PALETTE_GROUPS: Record<string, string[]> = {
  network: ['internet', 'publicIp', 'router', 'switch', 'vlan', 'gateway', 'subnet'],
  systems: ['server', 'vm', 'hypervisor', 'storage', 'backup', 'endpoint'],
  identity: ['ad', 'dc', 'entra', 'sync', 'm365'],
  service: ['firewall', 'vpn', 'dns', 'dhcp', 'service']
};
