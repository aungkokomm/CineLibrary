import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'

export default function FiltersBar() {
  const { genre, director, actor, year, driveSerial, drives, facets, setFilter, clearFilters, showMissing } = useStore()
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenMenu(null)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const activeDrive = drives.find(d => d.volume_serial === driveSerial)
  const hasAny = !!(genre || director || actor || year || driveSerial)

  return (
    <div className="filters-bar" ref={ref}>
      {/* Genre */}
      <div className="filter-dropdown">
        <button
          className={`filter-chip ${genre ? 'active' : ''}`}
          onClick={e => { e.stopPropagation(); setOpenMenu(openMenu === 'genre' ? null : 'genre') }}
        >
          <span>🎭</span>
          <span>{genre || 'Genre'}</span>
          {genre && <span className="filter-chip-x" onClick={e => { e.stopPropagation(); setFilter({ genre: null }) }}>×</span>}
        </button>
        {openMenu === 'genre' && facets && (
          <div className="filter-dropdown-menu">
            {facets.genres.map(g => (
              <div key={g.name} className="filter-dropdown-item" onClick={() => { setFilter({ genre: g.name }); setOpenMenu(null) }}>
                <span>{g.name}</span>
                <span className="filter-dropdown-item-count">{g.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Director */}
      <div className="filter-dropdown">
        <button
          className={`filter-chip ${director ? 'active' : ''}`}
          onClick={e => { e.stopPropagation(); setOpenMenu(openMenu === 'director' ? null : 'director') }}
        >
          <span>🎥</span>
          <span>{director || 'Director'}</span>
          {director && <span className="filter-chip-x" onClick={e => { e.stopPropagation(); setFilter({ director: null }) }}>×</span>}
        </button>
        {openMenu === 'director' && facets && (
          <div className="filter-dropdown-menu">
            {facets.directors.slice(0, 100).map(d => (
              <div key={d.name} className="filter-dropdown-item" onClick={() => { setFilter({ director: d.name }); setOpenMenu(null) }}>
                <span>{d.name}</span>
                <span className="filter-dropdown-item-count">{d.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actor */}
      <div className="filter-dropdown">
        <button
          className={`filter-chip ${actor ? 'active' : ''}`}
          onClick={e => { e.stopPropagation(); setOpenMenu(openMenu === 'actor' ? null : 'actor') }}
        >
          <span>🎭</span>
          <span>{actor || 'Actor'}</span>
          {actor && <span className="filter-chip-x" onClick={e => { e.stopPropagation(); setFilter({ actor: null }) }}>×</span>}
        </button>
        {openMenu === 'actor' && facets && (
          <div className="filter-dropdown-menu">
            {facets.actors.slice(0, 150).map(a => (
              <div key={a.name} className="filter-dropdown-item" onClick={() => { setFilter({ actor: a.name }); setOpenMenu(null) }}>
                <span>{a.name}</span>
                <span className="filter-dropdown-item-count">{a.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Year */}
      <div className="filter-dropdown">
        <button
          className={`filter-chip ${year ? 'active' : ''}`}
          onClick={e => { e.stopPropagation(); setOpenMenu(openMenu === 'year' ? null : 'year') }}
        >
          <span>📅</span>
          <span>{year || 'Year'}</span>
          {year && <span className="filter-chip-x" onClick={e => { e.stopPropagation(); setFilter({ year: null }) }}>×</span>}
        </button>
        {openMenu === 'year' && facets && (
          <div className="filter-dropdown-menu" style={{ minWidth: 140 }}>
            {facets.years.map(y => (
              <div key={y} className="filter-dropdown-item" onClick={() => { setFilter({ year: y }); setOpenMenu(null) }}>
                <span>{y}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Drive */}
      <div className="filter-dropdown">
        <button
          className={`filter-chip ${driveSerial ? 'active' : ''}`}
          onClick={e => { e.stopPropagation(); setOpenMenu(openMenu === 'drive' ? null : 'drive') }}
        >
          <span>💾</span>
          <span>{activeDrive?.label || 'Drive'}</span>
          {driveSerial && <span className="filter-chip-x" onClick={e => { e.stopPropagation(); setFilter({ driveSerial: null }) }}>×</span>}
        </button>
        {openMenu === 'drive' && (
          <div className="filter-dropdown-menu">
            {drives.map(d => (
              <div key={d.volume_serial} className="filter-dropdown-item" onClick={() => { setFilter({ driveSerial: d.volume_serial }); setOpenMenu(null) }}>
                <span>
                  <span className={`drive-dot ${d.is_connected ? 'online' : 'offline'}`} style={{ marginRight: 8 }} />
                  {d.label}
                </span>
                <span className="filter-dropdown-item-count">{d.movie_count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Missing toggle */}
      <button
        className={`filter-chip ${!showMissing ? 'active' : ''}`}
        onClick={() => setFilter({ showMissing: !showMissing })}
        title={showMissing ? 'Click to hide missing movies' : 'Showing only available'}
      >
        {showMissing ? '👁 Show Missing' : '🚫 Hide Missing'}
      </button>

      {hasAny && (
        <button className="filter-chip" onClick={clearFilters} style={{ marginLeft: 'auto' }}>
          ✕ Clear All
        </button>
      )}
    </div>
  )
}
