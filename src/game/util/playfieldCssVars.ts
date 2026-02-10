interface PlayfieldCssBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PlayfieldCssVarsInput extends PlayfieldCssBounds {
  cornerRadius: number;
}

export const setPlayfieldCssVars = ({
  cornerRadius,
  height,
  width,
  x,
  y,
}: PlayfieldCssVarsInput): void => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--play-x", `${x}px`);
  root.style.setProperty("--play-y", `${y}px`);
  root.style.setProperty("--play-w", `${width}px`);
  root.style.setProperty("--play-h", `${height}px`);
  root.style.setProperty("--play-cx", `${x + width / 2}px`);
  root.style.setProperty("--play-cy", `${y + height / 2}px`);
  root.style.setProperty("--play-r", `${cornerRadius}px`);
};
