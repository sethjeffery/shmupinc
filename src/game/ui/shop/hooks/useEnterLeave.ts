import { useCallback, useEffect, useRef, useState } from "preact/hooks";

interface UseEnterLeaveProps {
  entryDuration?: number;
  exitDuration?: number;
  startEntering?: boolean;
}

export function useEnterLeave({
  entryDuration = 1000,
  exitDuration = 1000,
  startEntering = true,
}: UseEnterLeaveProps) {
  const enterTimerRef = useRef<null | number>(null);
  const exitTimerRef = useRef<null | number>(null);
  const enteringPromiseRef = useRef<null | Promise<void>>(null);
  const leavingPromiseRef = useRef<null | Promise<void>>(null);
  const [entering, setEntering] = useState(startEntering);
  const [leaving, setLeaving] = useState(false);
  const [entered, setEntered] = useState(false);

  const leave = useCallback(() => {
    if (leavingPromiseRef.current) return leavingPromiseRef.current;
    const promise = new Promise<void>((resolve) => {
      setLeaving(true);
      exitTimerRef.current = window.setTimeout(() => {
        setEntered(false);
        setLeaving(false);
        leavingPromiseRef.current = null;
        resolve();
      }, exitDuration);
    });
    leavingPromiseRef.current = promise;
    return promise;
  }, [exitDuration]);

  const enter = useCallback(() => {
    if (enteringPromiseRef.current) return enteringPromiseRef.current;
    setEntering(true);
    const promise = new Promise<void>((resolve) => {
      enterTimerRef.current = window.setTimeout(() => {
        setEntered(true);
        setEntering(false);
        enteringPromiseRef.current = null;
        resolve();
      }, entryDuration);
    });
    enteringPromiseRef.current = promise;
    return promise;
  }, [entryDuration]);

  useEffect(() => {
    if (startEntering) {
      void enter();
    }
  }, [startEntering, enter]);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }
      if (enterTimerRef.current !== null) {
        window.clearTimeout(enterTimerRef.current);
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
