import "./styles.css";

import { render } from "preact";

import { createGame, shouldUseMobileCoverScale } from "./game/createGame";
import { PLAYFIELD_CORNER_RADIUS, computePlayArea } from "./game/util/playArea";
import { setPlayfieldCssVars } from "./game/util/playfieldCssVars";
import { UiRouter } from "./ui/router";

const OuterShell = () => (
  <div className="outer-shell">
    <div className="outer-lines" />
    <div className="outer-label outer-label--top">SIMULATION ENVIRONMENT</div>
    <div className="outer-label outer-label--bottom">SECTOR A-3</div>
  </div>
);

const startApp = async (): Promise<void> => {
  if (import.meta.env.DEV && window.location.pathname.startsWith("/content")) {
    const { initContentEditor } = await import("./content/editor");
    initContentEditor();
    return;
  }

  const outerShellRoot = document.getElementById("outer-shell-root");
  if (!(outerShellRoot instanceof HTMLDivElement)) {
    throw new Error("Missing #outer-shell-root host.");
  }
  render(<OuterShell />, outerShellRoot);

  const updateOuterVars = (): void => {
    const rect = shouldUseMobileCoverScale()
      ? { height: window.innerHeight, width: window.innerWidth, x: 0, y: 0 }
      : computePlayArea(window.innerWidth, window.innerHeight);
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
  const router = new UiRouter(game);
  window.addEventListener("beforeunload", () => router.dispose(), {
    once: true,
  });
};

void startApp();
