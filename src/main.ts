import './scss/main.scss';
import { restoreDraft } from './model';
import { render, renderInspector } from './rendering';
import { buildPalette, bindCanvasEvents, bindToolbarEvents, bindKeyboardEvents } from './events';

function init(): void {
  buildPalette();
  bindCanvasEvents();
  bindToolbarEvents();
  bindKeyboardEvents();
  restoreDraft();
  render();
  renderInspector();
}

init();
