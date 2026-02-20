import { useTimedProgress } from "./useTimedProgress";

export function useTypewriter(
  text: string,
  speed: number,
  { offset = 0, restartKey }: { offset?: number; restartKey?: string } = {},
): string {
  const visibleChars =
    useTimedProgress(speed * text.length, { offset, restartKey }) * text.length;
  return text.slice(0, Math.floor(visibleChars));
}
