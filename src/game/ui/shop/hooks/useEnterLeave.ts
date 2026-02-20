import { signal } from "@preact/signals";
import { useCallback, useEffect, useState } from "preact/hooks";

interface UseEnterLeaveProps {
  entryDuration?: number;
  exitDuration?: number;
  startEntering?: boolean;
}

const enterTimer = signal<null | number>(null);
const exitTimer = signal<null | number>(null);

export function useEnterLeave({
  entryDuration = 1000,
  exitDuration = 1000,
  startEntering = true,
}: UseEnterLeaveProps) {
  const [entering, setEntering] = useState(startEntering);
  const [leaving, setLeaving] = useState(false);
  const [entered, setEntered] = useState(false);
  const [leavingPromise, setLeavingPromise] = useState<null | Promise<void>>(
    null,
  );
  const [enteringPromise, setEnteringPromise] = useState<null | Promise<void>>(
    null,
  );

  const leave = useCallback(() => {
    if (leavingPromise) return leavingPromise;
    const promise = new Promise<void>((resolve) => {
      setLeaving(true);
      exitTimer.value = window.setTimeout(() => {
        setEntered(false);
        setLeaving(false);
        resolve();
      }, exitDuration);
    });
    setLeavingPromise(promise);
    return promise;
  }, [exitDuration, leavingPromise]);

  const enter = useCallback(() => {
    if (enteringPromise) return;
    const promise = new Promise<void>((resolve) => {
      enterTimer.value = window.setTimeout(() => {
        setEntered(true);
        setEntering(false);
        resolve();
      }, entryDuration);
    });
    setEnteringPromise(promise);
    return promise;
  }, [enteringPromise, entryDuration]);

  useEffect(() => {
    if (startEntering) {
      void enter();
    }
  }, [startEntering, enter]);

  useEffect(() => {
    return () => {
      if (exitTimer.value !== null) {
        window.clearTimeout(exitTimer.value);
      }
      if (enterTimer.value !== null) {
        window.clearTimeout(enterTimer.value);
      }
    };
  }, []);

  return {
    enter,
    entered,
    entering,
    leave,
    leaving,
  };
}
