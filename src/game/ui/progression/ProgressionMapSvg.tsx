import type { GalaxyView } from "../../data/galaxyProgress";
import type { AmbientStar } from "./hooks/useProgressionAmbientStars";

import clsx from "clsx";

import {
  PROGRESSION_EDGE_DRAW_OFFSET_MS,
  PROGRESSION_REVEAL_INITIAL_DELAY_MS,
  PROGRESSION_REVEAL_STEP_MS,
} from "./constants";

import styles from "./ProgressionMapSvg.module.css";

interface ProgressionMapSvgProps {
  ambientStars: AmbientStar[];
  isLaunching: boolean;
  labelOffset: number;
  launchingNodeId: null | string;
  mapHeight: number;
  mapWidth: number;
  nodePingRadius: number;
  nodeRadius: number;
  onLaunchNode: (nodeId: string) => void;
  projectX: (normalizedX: number) => number;
  projectY: (normalizedY: number) => number;
  starsOffset: number;
  view: GalaxyView;
}

const sanitizeSvgId = (value: string): string =>
  value.replace(/[^a-zA-Z0-9_-]/g, "-");

export function ProgressionMapSvg(props: ProgressionMapSvgProps) {
  const nodeById = new Map(props.view.nodes.map((node) => [node.id, node]));
  const launchingNode = props.launchingNodeId
    ? (nodeById.get(props.launchingNodeId) ?? null)
    : null;
  const svgPrefix = `progression-${sanitizeSvgId(props.view.id)}`;

  return (
    <svg
      className={clsx(styles.map, props.isLaunching && styles.launching)}
      style={
        launchingNode
          ? {
              transformOrigin: `${(launchingNode.pos.x * 100).toFixed(2)}% ${(
                launchingNode.pos.y * 100
              ).toFixed(2)}%`,
            }
          : undefined
      }
      viewBox={`0 0 ${props.mapWidth} ${props.mapHeight}`}
    >
      <defs>
        <linearGradient id={`${svgPrefix}-edge-active`} x1="0%" x2="100%">
          <stop offset="0%" stopColor="rgba(125, 249, 255, 0.25)" />
          <stop offset="100%" stopColor="rgba(125, 249, 255, 0.8)" />
        </linearGradient>
      </defs>

      <g className={styles.ambient} aria-hidden="true">
        {props.ambientStars.map((star, index) => (
          <circle
            className={styles.ambientStar}
            cx={star.cx}
            cy={star.cy}
            key={`ambient-star-${index}`}
            r={star.r}
            style={{
              animationDelay: `${star.delaySec.toFixed(2)}s`,
              animationDuration: `${star.durationSec.toFixed(2)}s`,
              opacity: star.opacity,
            }}
          />
        ))}
      </g>

      {props.view.edges.map((edge, edgeIndex) => {
        const from = nodeById.get(edge.from);
        const to = nodeById.get(edge.to);
        if (!from || !to) return null;

        const x1 = props.projectX(from.pos.x);
        const y1 = props.projectY(from.pos.y);
        const x2 = props.projectX(to.pos.x);
        const y2 = props.projectY(to.pos.y);
        const edgeLength = Math.hypot(x2 - x1, y2 - y1);
        const edgeDelayMs =
          PROGRESSION_REVEAL_INITIAL_DELAY_MS +
          edgeIndex * PROGRESSION_REVEAL_STEP_MS +
          PROGRESSION_EDGE_DRAW_OFFSET_MS;

        return (
          <line
            className={clsx(
              styles.edge,
              edge.isCompleted && styles.complete,
              edge.isUnlocked && styles.unlocked,
              styles.sequenced,
            )}
            key={`${edge.from}-${edge.to}`}
            stroke={
              edge.isCompleted
                ? undefined
                : edge.isUnlocked
                  ? `url(#${svgPrefix}-edge-active)`
                  : undefined
            }
            style={{
              animationDelay: `${edgeDelayMs}ms`,
              strokeDasharray: edgeLength,
              strokeDashoffset: edgeLength,
            }}
            x1={x1}
            x2={x2}
            y1={y1}
            y2={y2}
          />
        );
      })}

      {props.view.nodes.map((node, nodeIndex) => {
        const x = props.projectX(node.pos.x);
        const y = props.projectY(node.pos.y);
        const nodeDelayMs =
          PROGRESSION_REVEAL_INITIAL_DELAY_MS +
          nodeIndex * PROGRESSION_REVEAL_STEP_MS;
        const canLaunch = node.isSelectable || node.isReplayable;
        const labelWidth = Math.max(120, node.name.length * 9);
        const starsWidth = Math.max(56, node.starCap * 18);
        const hitWidth =
          Math.max(props.nodeRadius * 2 + 30, labelWidth, starsWidth) + 18;
        const hitHeight = props.starsOffset + props.nodeRadius + 16;
        const hitX = x - hitWidth / 2;
        const hitY = y - props.nodeRadius - 12;

        return (
          <g
            className={clsx(
              styles.node,
              node.isCompleted && styles.complete,
              node.isCurrent && styles.current,
              node.isUnlocked && styles.unlocked,
              canLaunch && styles.actionable,
              styles.sequenced,
            )}
            key={node.id}
            onClick={() => {
              if (!canLaunch) return;
              props.onLaunchNode(node.id);
            }}
            onKeyDown={(event) => {
              if (
                event.key !== "Enter" &&
                event.key !== " " &&
                event.key !== "Spacebar"
              ) {
                return;
              }
              event.preventDefault();
              if (!canLaunch) return;
              props.onLaunchNode(node.id);
            }}
            role="button"
            style={{ animationDelay: `${nodeDelayMs}ms` }}
            tabIndex={0}
          >
            {canLaunch ? (
              <rect
                fill="transparent"
                height={hitHeight}
                pointerEvents="all"
                rx={14}
                ry={14}
                stroke="none"
                width={hitWidth}
                x={hitX}
                y={hitY}
              />
            ) : null}
            {node.isCurrent ? (
              <>
                <circle
                  className={clsx(styles.ping, styles.pingA)}
                  cx={x}
                  cy={y}
                  r={props.nodePingRadius}
                />
                <circle
                  className={clsx(styles.ping, styles.pingB)}
                  cx={x}
                  cy={y}
                  r={props.nodePingRadius}
                />
              </>
            ) : null}

            <circle cx={x} cy={y} r={props.nodeRadius} />

            {node.isSelectable || node.isCompleted ? (
              <>
                <text className={styles.label} x={x} y={y + props.labelOffset}>
                  {node.name}
                </text>
                <text className={styles.stars} x={x} y={y + props.starsOffset}>
                  {Array.from({ length: node.starCap }, (_, i) => (
                    <tspan
                      key={i}
                      className={i < node.stars ? styles.starred : ""}
                    >
                      ★
                    </tspan>
                  ))}
                </text>
              </>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
