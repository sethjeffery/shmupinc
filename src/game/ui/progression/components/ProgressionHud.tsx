interface ProgressionHudProps {
  currentNodeName: null | string;
  description?: string;
  isComplete: boolean;
  menuDisabled: boolean;
  onMenu: () => void;
  titleText: string;
}

export function ProgressionHud(props: ProgressionHudProps) {
  return (
    <>
      <div className="progression-map-hud">
        <div className="progression-map-title">
          <span className="progression-map-title-text">
            {props.titleText || "\u00a0"}
          </span>
          <span aria-hidden="true" className="progression-map-title-cursor">
            _
          </span>
        </div>
        <button
          className="progression-map-menu"
          disabled={props.menuDisabled}
          onClick={props.onMenu}
          type="button"
        >
          Main Menu
        </button>
      </div>
      <div className="progression-map-caption">{props.description ?? ""}</div>
      <div className="progression-map-current">
        {props.isComplete
          ? "Galaxy Complete"
          : props.currentNodeName
            ? `Current: ${props.currentNodeName}`
            : "Campaign ready"}
      </div>
    </>
  );
}
