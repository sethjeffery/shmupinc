import "./styles.css";

import { createGame } from "./game/createGame";
import { PLAYFIELD_CORNER_RADIUS, computePlayArea } from "./game/util/playArea";
import { setPlayfieldCssVars } from "./game/util/playfieldCssVars";
import { UiRouter } from "./ui/router";

const startApp = async (): Promise<void> => {
  if (import.meta.env.DEV && window.location.pathname.startsWith("/content")) {
    const { initContentEditor } = await import("./content/editor");
    initContentEditor();
    return;
  }

  const outerShell = document.createElement("div");
  outerShell.className = "outer-shell";
  outerShell.innerHTML = `
    <div class="outer-lines"></div>
    <div class="outer-label outer-label--top">SIMULATION ENVIRONMENT</div>
    <div class="outer-label outer-label--bottom">SECTOR A-3</div>
  `;
  document.body.appendChild(outerShell);

  const updateOuterVars = (): void => {
    const rect = computePlayArea(window.innerWidth, window.innerHeight);
    setPlayfieldCssVars({
      cornerRadius: PLAYFIELD_CORNER_RADIUS,
      height: rect.height,
      width: rect.width,
      x: rect.x,
      y: rect.y,
    });
  };
  updateOuterVars();
  window.addEventListener("resize", updateOuterVars);

  const game = createGame();
  new UiRouter(game);
};

void startApp();
