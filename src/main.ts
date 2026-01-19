import './styles.css';

import { createGame } from './game/createGame';
import { PLAYFIELD_CORNER_RADIUS, computePlayArea } from './game/util/playArea';
import { UiRouter } from './ui/router';

const outerShell = document.createElement('div');
outerShell.className = 'outer-shell';
outerShell.innerHTML = `
  <div class="outer-lines"></div>
  <div class="outer-label outer-label--top">SIMULATION ENVIRONMENT</div>
  <div class="outer-label outer-label--bottom">SECTOR A-3</div>
`;
document.body.appendChild(outerShell);

const updateOuterVars = (): void => {
  const rect = computePlayArea(window.innerWidth, window.innerHeight);
  const root = document.documentElement;
  root.style.setProperty('--play-x', `${rect.x}px`);
  root.style.setProperty('--play-y', `${rect.y}px`);
  root.style.setProperty('--play-w', `${rect.width}px`);
  root.style.setProperty('--play-h', `${rect.height}px`);
  root.style.setProperty('--play-cx', `${rect.x + rect.width / 2}px`);
  root.style.setProperty('--play-cy', `${rect.y + rect.height / 2}px`);
  root.style.setProperty('--play-r', `${PLAYFIELD_CORNER_RADIUS}px`);
};
updateOuterVars();
window.addEventListener('resize', updateOuterVars);

const game = createGame();
new UiRouter(game);
