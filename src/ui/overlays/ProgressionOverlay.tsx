import type { GalaxyView } from "../../game/data/galaxyProgress";

import { useEffect, useRef, useState } from "preact/hooks";

const PROGRESSION_MAP_WIDTH = 1000;
const PROGRESSION_MAP_HEIGHT = 640;

interface AmbientStar {
  cx: number;
  cy: number;
  delaySec: number;
  durationSec: number;
  opacity: number;
  r: number;
}

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const createRng = (seedValue: number): (() => number) => {
  let seed = seedValue >>> 0;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const sanitizeSvgId = (value: string): string =>
  value.replace(/[^a-zA-Z0-9_-]/g, "-");

const buildAmbientStars = (galaxyId: string): AmbientStar[] => {
  const rand = createRng(hashString(`stars:${galaxyId}`));
  const stars: AmbientStar[] = [];
  for (let index = 0; index < 180; index += 1) {
    stars.push({
      cx: rand() * PROGRESSION_MAP_WIDTH,
      cy: rand() * PROGRESSION_MAP_HEIGHT,
      delaySec: rand() * 8,
      durationSec: 2.8 + rand() * 8.6,
      opacity: 0.2 + rand() * 0.7,
      r: rand() > 0.88 ? 2 + rand() * 2 : 0.7 + rand() * 1.4,
    });
  }
  return stars;
};

export default function ProgressionOverlay(props: {
  onAction: (action: string, levelId?: string) => void;
  view: GalaxyView;
}) {
  const [launchingNodeId, setLaunchingNodeId] = useState<null | string>(null);
  const launchTimerRef = useRef<null | number>(null);

  useEffect(
    () => () => {
      if (launchTimerRef.current === null || typeof window === "undefined") {
        return;
      }
      window.clearTimeout(launchTimerRef.current);
      launchTimerRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (launchingNodeId) return;
    if (launchTimerRef.current === null || typeof window === "undefined") {
      return;
    }
    window.clearTimeout(launchTimerRef.current);
    launchTimerRef.current = null;
  }, [launchingNodeId]);

  const svgPrefix = `progression-${sanitizeSvgId(props.view.id)}`;
  const ambientStars = buildAmbientStars(props.view.id);
  const nodeById = new Map(props.view.nodes.map((node) => [node.id, node]));
  const currentNode =
    props.view.nodes.find((node) => node.isCurrent) ??
    props.view.nodes[0] ??
    null;
  const launchingNode = launchingNodeId
    ? (nodeById.get(launchingNodeId) ?? null)
    : null;

  const triggerLaunch = (nodeId: string): void => {
    if (launchingNodeId) return;
    setLaunchingNodeId(nodeId);
    if (typeof window === "undefined") {
      props.onAction("galaxy-node", nodeId);
      return;
    }
    launchTimerRef.current = window.setTimeout(() => {
      props.onAction("galaxy-node", nodeId);
      setLaunchingNodeId(null);
      launchTimerRef.current = null;
    }, 1000);
  };

  return (
    <div
      className={`progression-shell${launchingNodeId ? " is-launching" : ""}`}
    >
      <div className="progression-map-frame">
        <svg
          className={`progression-map${launchingNodeId ? " is-launching" : ""}`}
          style={
            launchingNode
              ? {
                  transformOrigin: `${(launchingNode.pos.x * 100).toFixed(2)}% ${(
                    launchingNode.pos.y * 100
                  ).toFixed(2)}%`,
                }
              : undefined
          }
          viewBox={`0 0 ${PROGRESSION_MAP_WIDTH} ${PROGRESSION_MAP_HEIGHT}`}
        >
          <defs>
            <linearGradient id={`${svgPrefix}-edge-active`} x1="0%" x2="100%">
              <stop offset="0%" stopColor="rgba(125, 249, 255, 0.25)" />
              <stop offset="100%" stopColor="rgba(125, 249, 255, 0.8)" />
            </linearGradient>
          </defs>

          <g className="progression-ambient" aria-hidden="true">
            {ambientStars.map((star, index) => (
              <circle
                className="progression-ambient-star"
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

          {props.view.edges.map((edge) => {
            const from = nodeById.get(edge.from);
            const to = nodeById.get(edge.to);
            if (!from || !to) return null;
            const x1 = from.pos.x * PROGRESSION_MAP_WIDTH;
            const y1 = from.pos.y * PROGRESSION_MAP_HEIGHT;
            const x2 = to.pos.x * PROGRESSION_MAP_WIDTH;
            const y2 = to.pos.y * PROGRESSION_MAP_HEIGHT;
            const className = `progression-edge${
              edge.isCompleted
                ? " is-complete"
                : edge.isUnlocked
                  ? " is-unlocked"
                  : ""
            }`;
            return (
              <line
                className={className}
                key={`${edge.from}-${edge.to}`}
                stroke={
                  edge.isCompleted
                    ? undefined
                    : edge.isUnlocked
                      ? `url(#${svgPrefix}-edge-active)`
                      : undefined
                }
                x1={x1}
                x2={x2}
                y1={y1}
                y2={y2}
              />
            );
          })}
          {props.view.nodes.map((node) => {
            const x = node.pos.x * PROGRESSION_MAP_WIDTH;
            const y = node.pos.y * PROGRESSION_MAP_HEIGHT;
            const className = `progression-node${
              node.isCompleted ? " is-complete" : ""
            }${node.isCurrent ? " is-current" : ""}${
              node.isUnlocked ? " is-unlocked" : " is-locked"
            }${node.isSelectable || node.isReplayable ? " is-actionable" : ""}`;
            return (
              <g
                className={className}
                key={node.id}
                onClick={() => {
                  if (!node.isSelectable && !node.isReplayable) return;
                  triggerLaunch(node.id);
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
                  if (!node.isSelectable && !node.isReplayable) return;
                  triggerLaunch(node.id);
                }}
                role="button"
                tabIndex={0}
              >
                {node.isCurrent ? (
                  <>
                    <circle
                      className="progression-node-ping ping-a"
                      cx={x}
                      cy={y}
                      r={24}
                    />
                    <circle
                      className="progression-node-ping ping-b"
                      cx={x}
                      cy={y}
                      r={24}
                    />
                  </>
                ) : null}
                <circle cx={x} cy={y} r={20} />
                {node.isSelectable ? (
                  <>
                    <text className="progression-node-label" x={x} y={y + 44}>
                      {node.name}
                    </text>
                    <text className="progression-node-stars" x={x} y={y + 60}>
                      {Array.from({ length: node.starCap }, (_, i) => (
                        <tspan
                          key={i}
                          className={i < node.stars ? "is-starred" : ""}
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
        <div className="progression-map-fade" />
        <div className="progression-map-hud">
          <div className="progression-map-title">{props.view.name}</div>
          <button
            className="progression-map-menu"
            onClick={() => {
              if (launchingNodeId) return;
              props.onAction("menu");
            }}
            type="button"
          >
            Main Menu
          </button>
        </div>
        <div className="progression-map-caption">
          {props.view.description ?? ""}
        </div>
        <div className="progression-map-current">
          {props.view.isComplete
            ? "Galaxy Complete"
            : currentNode
              ? `Current: ${currentNode.name}`
              : "Campaign ready"}
        </div>
      </div>
    </div>
  );
}
