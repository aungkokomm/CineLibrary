import { useState } from 'react'
import { useStore } from '../store'
import type { Drive } from '../api'

export default function DrivesPage() {
  const { drives, refreshAll, scanProgress } = useStore()
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd() {
    setAdding(true); setError(null)
    try {
      const result = await window.api.drives.add()
      if (result?.error) setError(result.error)
      else if (result) {
        await refreshAll()
        // Auto-scan newly added drive
        window.api.drives.scan(result.volume_serial)
      }
    } finally { setAdding(false) }
  }

  return (
    <div className="drives-page">
      <div className="drives-header">
        <div>
          <h2>Your Drives</h2>
          <p className="drives-sub">
            External HDDs that hold your movies. Identified by hardware ID, so drive letter changes don't break anything.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleAdd} disabled={adding}>
          {adding ? '⏳ Selecting...' : '＋ Add Drive'}
        </button>
      </div>

      {error && <div className="welcome-error" style={{ margin: '0 0 20px' }}>⚠️ {error}</div>}

      <div className="drives-list">
        {drives.map(d => (
          <DriveCard key={d.volume_serial} drive={d} scanProgress={scanProgress[d.volume_serial]} />
        ))}

        {drives.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">💾</div>
            <div className="empty-title">No drives added yet</div>
            <div className="empty-sub">Click "Add Drive" to register your first external HDD</div>
          </div>
        )}
      </div>
    </div>
  )
}

interface DriveCardProps {
  drive: Drive
  scanProgress?: any
}

function DriveCard({ drive, scanProgress }: DriveCardProps) {
  const { refreshAll } = useStore()
  const [editing, setEditing] = useState(false)
  const [newLabel, setNewLabel] = useState(drive.label)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [addingRoot, setAddingRoot] = useState(false)

  async function saveRename() {
    if (!newLabel.trim() || newLabel === drive.label) { setEditing(false); return }
    await window.api.drives.rename(drive.volume_serial, newLabel.trim())
    await refreshAll()
    setEditing(false)
  }

  async function handleScan() {
    setScanning(true)
    const result = await window.api.drives.scan(drive.volume_serial)
    if (result?.error) alert(result.error)
    await refreshAll()
    setScanning(false)
  }

  async function handleRemove() {
    await window.api.drives.remove(drive.volume_serial)
    await refreshAll()
  }

  async function handleRemoveMissing() {
    if (!confirm(`Remove all ${drive.missing_count} missing movies from this drive's catalog? This only affects CineLibrary's database — it doesn't touch any files.`)) return
    await window.api.movies.removeMissing(drive.volume_serial)
    await refreshAll()
  }

  async function handleAddRoot() {
    setAddingRoot(true)
    const result = await window.api.drives.addRoot(drive.volume_serial)
    if (result?.error) alert(result.error)
    else if (result) await refreshAll()
    setAddingRoot(false)
  }

  async function handleRemoveRoot(rootId: number, rootPath: string) {
    if (!confirm(`Remove folder "${rootPath}" from this drive?\nMovies in this folder will be marked as missing.`)) return
    const result = await window.api.drives.removeRoot(drive.volume_serial, rootId)
    if (result?.error) alert(result.error)
    else await refreshAll()
  }

  const busy = scanning || (scanProgress && scanProgress.phase !== 'done')
  const progress = scanProgress && scanProgress.phase !== 'done' ? scanProgress : null

  return (
    <div className="drive-card">
      <div className="drive-card-header">
        <div className={`drive-status-icon ${drive.is_connected ? 'online' : 'offline'}`}>
          💾
        </div>
        <div className="drive-card-info">
          {editing ? (
            <div className="drive-rename">
              <input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveRename()
                  if (e.key === 'Escape') { setNewLabel(drive.label); setEditing(false) }
                }}
                autoFocus
              />
              <button className="btn btn-primary btn-sm" onClick={saveRename}>Save</button>
              <button className="btn btn-outline btn-sm" onClick={() => { setNewLabel(drive.label); setEditing(false) }}>Cancel</button>
            </div>
          ) : (
            <>
              <div className="drive-card-title">
                {drive.label}
                <button className="drive-rename-btn" onClick={() => setEditing(true)} title="Rename">✏️</button>
              </div>
              <div className="drive-card-status">
                {drive.is_connected ? (
                  <><span className="drive-dot online" /> Connected as {drive.current_letter}</>
                ) : (
                  <><span className="drive-dot offline" /> Not connected</>
                )}
              </div>
            </>
          )}

          {/* Folders list */}
          <div className="drive-roots">
            {(drive.roots ?? []).map(r => (
              <div key={r.id} className="drive-root-item">
                <span className="drive-root-icon">📁</span>
                <span className="drive-root-path">{r.root_path || '/ (drive root)'}</span>
                <button
                  className="drive-root-remove"
                  title="Remove this folder"
                  onClick={() => handleRemoveRoot(r.id, r.root_path)}
                >×</button>
              </div>
            ))}
            <button
              className="drive-root-add"
              onClick={handleAddRoot}
              disabled={addingRoot || !drive.is_connected}
              title={!drive.is_connected ? 'Connect the drive first' : 'Add another folder'}
            >
              {addingRoot ? '⏳' : '＋'} Add Folder
            </button>
          </div>
        </div>
        <div className="drive-card-numbers">
          <div className="drive-metric">
            <div className="drive-metric-value">{drive.movie_count}</div>
            <div className="drive-metric-label">Movies</div>
          </div>
          {drive.missing_count > 0 && (
            <div className="drive-metric">
              <div className="drive-metric-value" style={{ color: 'var(--accent-2)' }}>{drive.missing_count}</div>
              <div className="drive-metric-label">Missing</div>
            </div>
          )}
        </div>
      </div>

      {progress && (
        <div className="drive-progress">
          <div className="drive-progress-bar">
            <div
              className="drive-progress-fill"
              style={{ width: progress.total ? `${(progress.current / progress.total) * 100}%` : '0%' }}
            />
          </div>
          <div className="drive-progress-text">
            {progress.phase === 'scanning' && 'Scanning folders...'}
            {progress.phase === 'parsing' && (
              <>Parsing {progress.current}/{progress.total} · {progress.currentFile || ''}</>
            )}
            {progress.phase === 'copying' && 'Caching artwork...'}
          </div>
        </div>
      )}

      <div className="drive-card-actions">
        <button
          className="btn btn-primary btn-sm"
          onClick={handleScan}
          disabled={busy || !drive.is_connected}
          title={!drive.is_connected ? 'Plug in this drive first' : 'Re-scan for new/changed movies'}
        >
          {busy ? '⏳ Scanning...' : '🔄 Update Database'}
        </button>
        {drive.missing_count > 0 && (
          <button className="btn btn-outline btn-sm" onClick={handleRemoveMissing}>
            🧹 Clear {drive.missing_count} Missing
          </button>
        )}
        {confirmRemove ? (
          <>
            <button className="btn btn-danger btn-sm" onClick={handleRemove}>
              ✓ Confirm Remove Drive
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => setConfirmRemove(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button className="btn btn-outline btn-sm" onClick={() => setConfirmRemove(true)} style={{ marginLeft: 'auto' }}>
            🗑 Remove Drive
          </button>
        )}
      </div>
    </div>
  )
}
