import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import { useEnterLeave } from "../../shop/hooks/useEnterLeave";
import { PROGRESSION_ENTRY_MS, PROGRESSION_EXIT_MS } from "../constants";

type ExitIntent = "menu" | "node";

export const useProgressionLaunch = (
  onAction: (action: string, levelId?: string) => void,
) => {
  const { entered, entering, leave, leaving } = useEnterLeave({
    entryDuration: PROGRESSION_ENTRY_MS,
    exitDuration: PROGRESSION_EXIT_MS,
  });
  const [launchingNodeId, setLaunchingNodeId] = useState<null | string>(null);
  const [exitIntent, setExitIntent] = useState<ExitIntent | null>(null);
  const pendingActionRef = useRef<ExitIntent | null>(null);

  useEffect(() => {
    if (!leaving) {
      pendingActionRef.current = null;
      setExitIntent(null);
    }
  }, [leaving]);

  const triggerLaunch = useCallback(
    (nodeId: string): void => {
      if (launchingNodeId || leaving || pendingActionRef.current) return;
      pendingActionRef.current = "node";
      setExitIntent("node");
      setLaunchingNodeId(nodeId);
      void leave()?.then(() => {
        onAction("galaxy-node", nodeId);
      });
    },
    [launchingNodeId, leave, leaving, onAction],
  );

  const exitToMenu = useCallback((): void => {
    if (leaving || pendingActionRef.current) return;
    pendingActionRef.current = "menu";
    setExitIntent("menu");
    void leave()?.then(() => {
      onAction("menu");
    });
  }, [leave, leaving, onAction]);

  return {
    entered,
    entering,
    exitToMenu,
    isLaunching: leaving && exitIntent === "node",
    isLeavingMenu: leaving && exitIntent === "menu",
    launchingNodeId,
    leaving,
    triggerLaunch,
  };
};
