// Временная заглушка экрана (этап 1).
import { h } from '../dom.js';
import { screenTitle } from '../ui.js';
export function render(el) { el.append(screenTitle('grammar-editor'), h('div', { class: 'panel' }, h('p', { class: 'dim' }, 'Čoskoro :)'))); }
