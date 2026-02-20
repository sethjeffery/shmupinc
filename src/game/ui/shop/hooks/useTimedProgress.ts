import { useEffect, useMemo, useState } from "preact/hooks";

/**
 * Hook that returns a progress value between 0 and 1 based on the elapsed time since the component was mounted.
 * Good for time-based animation and typewriter effects.
 */
export function useTimedProgress(
  duration: number,
  {
    offset = 0,
    restartKey,
    step = 1000 / 60,
  }: { offset?: number; restartKey?: string; step?: number } = {},
): number {
  const startTime = useMemo(() => {
    void restartKey;
    return new Date().getTime();
  }, [restartKey]);
  const [progress, setProgress] = useState({
    currentKey: restartKey,
    duration,
    value: 0,
  });

  useEffect(() => {
    let raf = 0;

    const interval = setInterval(() => {
      raf = requestAnimationFrame(() => {
        setProgress((current) => {
          const elapsed = Math.max(
            0,
            new Date().getTime() - startTime - offset,
          );
          const value = elapsed / current.duration;
          return {
            ...current,
            currentKey: restartKey,
            value,
          };
        });
      });
    }, step);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(interval);
    };
  }, [duration, startTime, offset, restartKey, step]);

  return progress.currentKey === restartKey ? progress.value : 0;
}
