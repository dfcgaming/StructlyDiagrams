import { InfraModel, AppSelection, NodeDrag, Pan, Marquee, ConnectDrag } from './types';

function blankModel(): InfraModel {
  return {
    version: 3,
    project: { name: 'Untitled Infrastructure', updated: new Date().toISOString() },
    nodes: [],
    connections: [],
    viewport: { x: 0, y: 0, scale: 1 }
  };
}

export const app: {
  model: InfraModel;
  selected: AppSelection;
  connectDrag: ConnectDrag | null;
  nodeDrag: NodeDrag | null;
  pan: Pan | null;
  marquee: Marquee | null;
  multiSelected: Set<string>;
  connectionsVisible: boolean;
  dirty: boolean;
  toastTimer: ReturnType<typeof setTimeout> | null;
  activeLabels: string[];
} = {
  model: blankModel(),
  selected: null,
  connectDrag: null,
  nodeDrag: null,
  pan: null,
  marquee: null,
  multiSelected: new Set<string>(),
  connectionsVisible: true,
  dirty: false,
  toastTimer: null,
  activeLabels: []
};

export function resetModel(name?: string): void {
  app.model = blankModel();
  if (name) app.model.project.name = name;
  app.selected = null;
  app.multiSelected.clear();
  app.activeLabels = [];
  app.dirty = false;
}
