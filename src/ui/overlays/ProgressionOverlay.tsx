import type { GalaxyView } from "../../game/data/galaxyProgress";

import { useEffect, useMemo, useRef, useState } from "preact/hooks";

const PROGRESSION_MAP_WIDTH = 1000;
const PROGRESSION_MAP_BASE_HEIGHT = 640;
const PROGRESSION_MAP_MAX_HEIGHT = 1800;
const PROGRESSION_MAP_STAR_COUNT = 180;
const PROGRESSION_MAP_BASE_ASPECT =
  PROGRESSION_MAP_WIDTH / PROGRESSION_MAP_BASE_HEIGHT;

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

const buildAmbientStars = (
  galaxyId: string,
  mapWidth: number,
  mapHeight: number,
): AmbientStar[] => {
  const areaScale =
    (mapWidth * mapHeight) /
    (PROGRESSION_MAP_WIDTH * PROGRESSION_MAP_BASE_HEIGHT);
  const starCount = Math.round(PROGRESSION_MAP_STAR_COUNT * areaScale);
  const clampedCount = Math.max(
    PROGRESSION_MAP_STAR_COUNT,
    Math.min(460, starCount),
  );
  const rand = createRng(
    hashString(`stars:${galaxyId}:${mapWidth}:${mapHeight}`),
  );
  const stars: AmbientStar[] = [];
  for (let index = 0; index < clampedCount; index += 1) {
    stars.push({
      cx: rand() * mapWidth,
      cy: rand() * mapHeight,
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
  const mapFrameRef = useRef<HTMLDivElement | null>(null);
  const [launchingNodeId, setLaunchingNodeId] = useState<null | string>(null);
  const [mapAspect, setMapAspect] = useState(PROGRESSION_MAP_BASE_ASPECT);
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const frame = mapFrameRef.current;
    if (!frame) return;
    const updateAspect = (): void => {
      const bounds = frame.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const nextAspect = bounds.width / bounds.height;
      setMapAspect((previous) =>
        Math.abs(previous - nextAspect) > 0.005 ? nextAspect : previous,
      );
    };
    updateAspect();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      updateAspect();
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const mapHeight = useMemo(() => {
    const aspect = Math.max(0.01, mapAspect);
    if (aspect >= PROGRESSION_MAP_BASE_ASPECT) {
      return PROGRESSION_MAP_BASE_HEIGHT;
    }
    const targetHeight = Math.round(PROGRESSION_MAP_WIDTH / aspect);
    return Math.min(PROGRESSION_MAP_MAX_HEIGHT, targetHeight);
  }, [mapAspect]);

  const projectY = (normalizedY: number): number =>
    Math.max(0, Math.min(1, normalizedY)) * mapHeight;

  const svgPrefix = `progression-${sanitizeSvgId(props.view.id)}`;
  const ambientStars = useMemo(
    () => buildAmbientStars(props.view.id, PROGRESSION_MAP_WIDTH, mapHeight),
    [props.view.id, mapHeight],
  );
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
      <div className="progression-map-frame" ref={mapFrameRef}>
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
          viewBox={`0 0 ${PROGRESSION_MAP_WIDTH} ${mapHeight}`}
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
            const y1 = projectY(from.pos.y);
            const x2 = to.pos.x * PROGRESSION_MAP_WIDTH;
            const y2 = projectY(to.pos.y);
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
            const y = projectY(node.pos.y);
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
