import { useState } from 'react'
import { useStore } from '../store'

export default function WelcomePage() {
  const { refreshAll } = useStore()
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd() {
    setAdding(true)
    setError(null)
    try {
      const result = await window.api.drives.add()
      if (result?.error) {
        setError(result.error)
      } else if (result) {
        await refreshAll()
        // Kick off first scan
        window.api.drives.scan(result.volume_serial)
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to add drive')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="welcome">
      <div className="welcome-inner scale-in">
        <div className="welcome-logo">
          <div className="welcome-logo-mark">🎬</div>
          <div>
            <h1 className="welcome-title">CineLibrary</h1>
            <p className="welcome-sub">Your portable movie catalog</p>
          </div>
        </div>

        <div className="welcome-body">
          <h2>Welcome!</h2>
          <p>
            CineLibrary builds a central catalog of all your MediaElch-scraped movies,
            so you can browse, search, and sort your entire collection — even when
            your external drives aren't plugged in.
          </p>

          <div className="welcome-steps">
            <div className="welcome-step">
              <span className="welcome-step-num">1</span>
              <div>
                <strong>Plug in an external drive</strong>
                <small>The one that already has MediaElch-scraped movies on it</small>
              </div>
            </div>
            <div className="welcome-step">
              <span className="welcome-step-num">2</span>
              <div>
                <strong>Point CineLibrary at your movie folder</strong>
                <small>We'll find all the .nfo files and cache metadata locally</small>
              </div>
            </div>
            <div className="welcome-step">
              <span className="welcome-step-num">3</span>
              <div>
                <strong>Browse your whole collection, anytime</strong>
                <small>Even when the drive is offline — metadata is cached</small>
              </div>
            </div>
          </div>

          {error && <div className="welcome-error">⚠️ {error}</div>}

          <button
            className="btn btn-primary btn-lg"
            onClick={handleAdd}
            disabled={adding}
            style={{ marginTop: 24, width: '100%', justifyContent: 'center' }}
          >
            {adding ? '⏳ Opening folder picker...' : '📂 Add Your First Drive'}
          </button>
        </div>
      </div>
    </div>
  )
}
