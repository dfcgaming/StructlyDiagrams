# StructlyDiagrams

A lightweight, browser-based IT infrastructure diagram builder. Drag-and-drop components, connect them, annotate with details, and export as JSON/SVG/PNG. Runs fully static — no server, no backend, no login required.

## Features

- **Drag-and-drop** infrastructure components: firewalls, servers, VLANs, switches, Active Directory, Microsoft 365, VPNs, and more
- **Connect nodes** with labeled edges (network, replication, dependency, sync, VPN)
- **Inspector panel** to edit node properties, labels, attached services, and custom notes
- **Collapsible branches** — hide downstream nodes without deleting them
- **Label highlighting** — filter and highlight nodes by label across the diagram
- **Auto Layout** — one-click tree-based arrangement
- **Fit to Canvas** — zoom and pan to fit all nodes
- **Export** as JSON (save/load), SVG, or PNG
- **Keyboard shortcuts**: Ctrl+S (save), Delete (remove), Escape (cancel)

## Tech Stack

- **TypeScript** (strict mode)
- **SCSS** styles
- **Webpack 5** bundles everything into `builds/index.html`
- **No frameworks** — vanilla DOM manipulation
- **Zero runtime dependencies** — all devDependencies only

## Getting Started

```bash
npm install
npm run build
```

Open `builds/index.html` in your browser.

For development with auto-rebuild on file changes:

```bash
npm run dev
```

## Project Structure

```
src/
├── main.ts              Entry point
├── types.ts             Interfaces + constants (TYPES, SERVICE_CATALOG, etc.)
├── state.ts             Shared app state
├── model.ts             Model CRUD, normalization, persistence
├── rendering.ts         DOM rendering, inspector, connections
├── layout.ts            Auto-layout, fit-to-canvas
├── io.ts                JSON save/load, SVG/PNG export
├── events.ts            Palette, canvas, toolbar, keyboard events
└── scss/                Compiled stylesheets
```

## How It Works

1. **Drag** a component from the left sidebar onto the canvas (or double-click it)
2. **Select** a node to edit its name, properties, labels, and services in the right inspector
3. **Connect** nodes by dragging from an output port (blue dot) to another node's input port
4. **Expand** nodes to see attached services, custom notes, and child details
5. **Save** your diagram as JSON to continue editing later, or export as SVG/PNG

## Deployment

Push to `main` — GitHub Actions builds and deploys to GitHub Pages automatically via `.github/workflows/static.yml`.

## License

[LICENSE](LICENSE)
