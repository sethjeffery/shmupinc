import type { GalaxyView } from "../../game/data/galaxyProgress";

import clsx from "clsx";

import { ProgressionHud } from "../../game/ui/progression/components/ProgressionHud";
import { ProgressionMapSvg } from "../../game/ui/progression/components/ProgressionMapSvg";
import { useProgressionAmbientStars } from "../../game/ui/progression/hooks/useProgressionAmbientStars";
import { useProgressionLaunch } from "../../game/ui/progression/hooks/useProgressionLaunch";
import { useProgressionMapLayout } from "../../game/ui/progression/hooks/useProgressionMapLayout";
import { useProgressionTitle } from "../../game/ui/progression/hooks/useProgressionTitle";

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
    entered,
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
        "progression-shell",
        entering ? "is-entering" : undefined,
        entered ? "is-entered" : undefined,
        isLeavingMenu ? "is-leaving-menu" : undefined,
        isLaunching ? "is-launching" : undefined,
      )}
    >
      <div className="progression-map-frame" ref={mapFrameRef}>
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
        <div className="progression-map-fade" />
        <ProgressionHud
          currentNodeName={currentNode?.name ?? null}
          description={props.view.description}
          isComplete={props.view.isComplete}
          menuDisabled={leaving}
          onMenu={exitToMenu}
          titleText={typedMapTitle}
        />
      </div>
    </div>
  );
}
