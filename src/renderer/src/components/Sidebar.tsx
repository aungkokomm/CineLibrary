import { useStore } from '../store'
import Icon from './Icon'

export default function Sidebar() {
  const {
    page, setPage, drives, stats,
    driveSerial, collectionId, setFilter, clearFilters,
    facets, collections
  } = useStore()

  const totalMovies = stats?.totalMovies ?? 0
  const topGenres = facets?.genres?.slice(0, 6) ?? []

  function goToLibrary() { clearFilters(); setPage('library') }
  function goToFavorites() { clearFilters(); setPage('favorites') }
  function goToDrives() { setPage('drives') }
  function pickDrive(serial: string) { setPage('library'); setFilter({ driveSerial: serial }) }
  function pickGenre(genre: string) { setPage('library'); setFilter({ genre }) }
  function pickCollection(id: number) { setPage('library'); setFilter({ collectionId: id }) }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo" onClick={() => window.app.about()} title="About CineLibrary">
        <div className="logo-icon">
          <Icon name="clapperboard" size={20} />
        </div>
        <div className="logo-text">
          <div className="logo-mark">CineLibrary</div>
          <div className="logo-sub">Movie Catalog</div>
        </div>
        <span className="logo-info">ⓘ</span>
      </div>

      <nav className="sidebar-nav">
        <div
          className={`nav-item ${page === 'library' && !driveSerial ? 'active' : ''}`}
          onClick={goToLibrary}
        >
          <Icon name="film" size={15} className="nav-icon" />
          <span>All Movies</span>
          <span className="nav-badge">{totalMovies}</span>
        </div>

        <div
          className={`nav-item ${page === 'favorites' ? 'active' : ''}`}
          onClick={goToFavorites}
        >
          <Icon name="star" size={15} className="nav-icon" />
          <span>Favorites</span>
        </div>

        <div
          className={`nav-item ${page === 'drives' ? 'active' : ''}`}
          onClick={goToDrives}
        >
          <Icon name="hdd" size={15} className="nav-icon" />
          <span>Drives</span>
          <span className="nav-badge">{drives.length}</span>
        </div>

        {drives.length > 0 && (
          <>
            <div className="nav-section-title">Libraries</div>
            {drives.map(d => (
              <div
                key={d.volume_serial}
                className={`nav-item ${driveSerial === d.volume_serial ? 'active' : ''}`}
                onClick={() => pickDrive(d.volume_serial)}
                title={`${d.label} (${d.is_connected ? 'Connected' : 'Offline'})`}
              >
                <span className={`drive-dot ${d.is_connected ? 'online' : 'offline'}`} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {d.label}
                </span>
                <span className="nav-badge">{d.movie_count}</span>
              </div>
            ))}
          </>
        )}

        {collections.length > 0 && (
          <>
            <div className="nav-section-title">Collections</div>
            {collections.map(c => (
              <div
                key={c.id}
                className={`nav-item ${collectionId === c.id ? 'active' : ''}`}
                onClick={() => pickCollection(c.id)}
                title={c.name}
              >
                <Icon name="film" size={14} className="nav-icon" />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {c.name}
                </span>
                <span className="nav-badge">{c.movie_count}</span>
              </div>
            ))}
          </>
        )}

        {topGenres.length > 0 && (
          <>
            <div className="nav-section-title">Top Genres</div>
            {topGenres.map(g => (
              <div
                key={g.name}
                className="nav-item"
                onClick={() => pickGenre(g.name)}
              >
                <Icon name="tag" size={14} className="nav-icon" />
                <span>{g.name}</span>
                <span className="nav-badge">{g.count}</span>
              </div>
            ))}
          </>
        )}
      </nav>

      {stats && (
        <div className="sidebar-stats">
          <div className="stat-row">
            <span className="stat-row-label">Total Runtime</span>
            <span className="stat-row-val">{formatRuntimeShort(stats.totalRuntime)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-row-label">Avg Rating</span>
            <span className="stat-row-val">
              {stats.avgRating ? '★ ' + stats.avgRating.toFixed(1) : '—'}
            </span>
          </div>
          {stats.totalMissing > 0 && (
            <div className="stat-row">
              <span className="stat-row-label">Missing</span>
              <span className="stat-row-val" style={{ color: 'var(--accent-2)' }}>
                {stats.totalMissing}
              </span>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}

function formatRuntimeShort(minutes: number): string {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}
