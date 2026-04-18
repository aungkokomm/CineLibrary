import Icon from './Icon'

export default function TitleBar() {
  return (
    <div className="titlebar">
      <div className="titlebar-drag" />
      <div className="titlebar-controls">
        <button
          className="titlebar-btn titlebar-minimize"
          onClick={() => window.win.minimize()}
          title="Minimize"
        >
          <Icon name="minus" size={11} />
        </button>
        <button
          className="titlebar-btn titlebar-maximize"
          onClick={() => window.win.maximize()}
          title="Maximize / Restore"
        >
          <Icon name="maximize" size={10} />
        </button>
        <button
          className="titlebar-btn titlebar-close"
          onClick={() => window.win.close()}
          title="Close"
        >
          <Icon name="close" size={11} />
        </button>
      </div>
    </div>
  )
}
