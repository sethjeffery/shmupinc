import type { GalaxyView } from "../../data/galaxyProgress";

import clsx from "clsx";

import { useProgressionAmbientStars } from "./hooks/useProgressionAmbientStars";
import { useProgressionLaunch } from "./hooks/useProgressionLaunch";
import { useProgressionMapLayout } from "./hooks/useProgressionMapLayout";
import { useProgressionTitle } from "./hooks/useProgressionTitle";
import { ProgressionHud } from "./ProgressionHud";
import { ProgressionMapSvg } from "./ProgressionMapSvg";

import styles from "./ProgressionOverlay.module.css";

export default function ProgressionOverlay(props: {
  onAction: (action: string, levelId?: string) => void;
  view: GalaxyView;
}) {
  const {
    labelOffset,
    mapFrameRef,
    mapHeight,
    mapWidth,
    nodePingRadius,
    nodeRadius,
    projectX,
    projectY,
    starsOffset,
  } = useProgressionMapLayout();
  const {
    entering,
    exitToMenu,
    isLaunching,
    isLeavingMenu,
    launchingNodeId,
    leaving,
    triggerLaunch,
  } = useProgressionLaunch(props.onAction);
  const ambientStars = useProgressionAmbientStars(
    props.view.id,
    mapWidth,
    mapHeight,
  );
  const typedMapTitle = useProgressionTitle(props.view);
  const currentNode =
    props.view.nodes.find((node) => node.isCurrent) ??
    props.view.nodes[0] ??
    null;

  return (
    <div
      className={clsx(
        styles.shell,
        entering && styles.entering,
        isLeavingMenu && styles.leavingMenu,
        isLaunching && styles.launching,
      )}
    >
      <div className={styles.frame} ref={mapFrameRef}>
        <ProgressionMapSvg
          ambientStars={ambientStars}
          isLaunching={isLaunching}
          labelOffset={labelOffset}
          launchingNodeId={launchingNodeId}
          mapHeight={mapHeight}
          mapWidth={mapWidth}
          nodePingRadius={nodePingRadius}
          nodeRadius={nodeRadius}
          onLaunchNode={triggerLaunch}
          projectX={projectX}
          projectY={projectY}
          starsOffset={starsOffset}
          view={props.view}
        />
        <div className={styles.fade} />
        <ProgressionHud
          currentNodeName={currentNode?.name ?? null}
          description={props.view.description}
          isComplete={props.view.isComplete}
          isLaunching={isLaunching}
          menuDisabled={leaving}
          onMenu={exitToMenu}
          titleText={typedMapTitle}
        />
      </div>
    </div>
  );
}
