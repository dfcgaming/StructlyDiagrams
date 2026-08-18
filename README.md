# StructlyDiagrams

**StructlyDiagrams** is a lightweight, browser-only tool for designing and documenting IT infrastructure diagrams. Built with plain HTML, CSS, and JavaScript, it runs fully static — no server, no backend, no login required.

Model your environment visually: servers, VLANs, networks, services, dependencies, and notes. Then **save your diagram as JSON** or **import an existing JSON file** to continue editing later. Everything stays in your browser unless you explicitly export it.

## What It Does

- Lets you create **IT infrastructure diagrams** such as:
  - Server racks and host inventories
  - Network segments and VLANs
  - Services and their dependencies
  - Documentation notes attached to nodes
- Provides a simple UI to:
  - Add nodes (servers, switches, firewalls, services, subnets, etc.)
  - Define relationships (e.g., “hosted on”, “connects to”, “depends on”)
  - Edit labels, IPs, VLAN IDs, roles, and free-form notes
- Supports **JSON import/export**:
  - Download your diagram as a `.json` file for backup or version control
  - Load a previously saved JSON file to edit or extend it
- Runs as a **static website**:
  - Open `index.html` locally, or
  - Host on GitHub Pages, Netlify, Vercel, or any static host

## Who It’s For

- Sysadmins, network engineers, and DevOps teams who need a simple way to visualize their infrastructure.
- Small to mid-size IT environments that want a lightweight, self-hosted diagram tool.
- Anyone who prefers file-based workflows (save/load JSON, commit to Git) over SaaS tools.

## Example Use Cases

- Document a small data center or homelab:
  - Hypervisors → VMs → services
  - Physical switches → VLANs → subnets
- Map service dependencies:
  - Web app → database → cache → message queue
- Keep an up-to-date network overview:
  - Core router → distribution switches → access switches → VLANs
- Add notes to nodes:
  - IPs, hostnames, credential references, maintenance windows, etc.

## Tech Stack

- **HTML5 + CSS3 + Vanilla JavaScript**
- No build step required (optional: you can add one later)
- Easy to extend with:
  - Custom node types (e.g., “firewall”, “storage”, “Kubernetes cluster”)
  - Custom fields (IP, VLAN, rack position, tags)
  - Themes or dark mode

## Example Workflow

1. Open the app in your browser.
2. Add a top-level node (e.g., “Datacenter” or “HQ Network”).
3. Add child nodes:
   - Servers, switches, firewalls, VLANs, services, etc.
4. Connect nodes to represent relationships:
   - “Hosted on”, “Connected to”, “Depends on”, etc.
5. Add notes and metadata to each node.
6. Click **Save as JSON** to download your diagram.
7. Later, click **Import JSON** to load and continue editing.

## Project Goals

- Keep the codebase **simple and readable**.
- Stay **lightweight** and dependency-free where possible.
- Provide a solid base that others can fork and extend into more advanced IT diagramming tools (e.g., auto-layout, import from CSV, integration with monitoring tools).
