import { useStore, SortKey } from '../store'
import Icon from './Icon'

export default function Topbar() {
  const {
    page, search, setSearch,
    sortKey, sortDir, setSort,
    viewMode, setViewMode,
    driveSerial, drives, genre
  } = useStore()

  const selectedDrive = drives.find(d => d.volume_serial === driveSerial)

  let title = 'All Movies'
  if (page === 'favorites') title = 'Favorites'
  else if (page === 'drives') title = 'Drives'
  else if (selectedDrive) title = selectedDrive.label
  else if (genre) title = genre

  const sortOptions: Array<{ key: SortKey; label: string }> = [
    { key: 'title', label: 'Title' },
    { key: 'year', label: 'Year' },
    { key: 'rating', label: 'Rating' },
    { key: 'runtime', label: 'Runtime' },
    { key: 'date_added', label: 'Date Added' }
  ]

  return (
    <div className="topbar">
      <span className="page-title">{title.toUpperCase()}</span>

      {page !== 'drives' && (
        <>
          <div className="search-wrap">
            <span className="search-icon"><Icon name="search" size={14} /></span>
            <input
              className="search-input"
              placeholder="Search title, actor, director, plot…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="topbar-actions">
            <select
              className="sort-select"
              value={`${sortKey}:${sortDir}`}
              onChange={e => {
                const [k, d] = e.target.value.split(':')
                setSort(k as SortKey, d as 'asc'|'desc')
              }}
            >
              {sortOptions.map(o => (
                <optgroup key={o.key} label={o.label}>
                  <option value={`${o.key}:asc`}>{o.label} ↑</option>
                  <option value={`${o.key}:desc`}>{o.label} ↓</option>
                </optgroup>
              ))}
            </select>

            <div className="view-toggle">
              <button
                className={viewMode === 'grid' ? 'active' : ''}
                onClick={() => setViewMode('grid')}
                title="Grid view"
              >⊞</button>
              <button
                className={viewMode === 'list' ? 'active' : ''}
                onClick={() => setViewMode('list')}
                title="List view"
              >☰</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
