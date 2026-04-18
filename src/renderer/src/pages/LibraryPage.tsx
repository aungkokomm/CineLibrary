import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import type { WatchedFilter } from '../store'
import MovieCard from '../components/MovieCard'
import MovieRow from '../components/MovieRow'
import FiltersBar from '../components/FiltersBar'

export default function LibraryPage() {
  const { movies, loading, loadingMore, hasMore, loadMoreMovies, viewMode, watchedFilter, setFilter } = useStore()
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Infinite scroll — fire loadMoreMovies when sentinel enters viewport
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMoreMovies() },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMoreMovies])

  const watchedOptions: Array<{ value: WatchedFilter; label: string }> = [
    { value: 'all',       label: 'All' },
    { value: 'unwatched', label: 'Unwatched' },
    { value: 'watched',   label: 'Watched' },
  ]

  return (
    <>
      <FiltersBar />

      <div className="library-body">
        <div className="library-header">
          <span className="library-count">
            {loading ? 'Loading…' : `${movies.length} movie${movies.length !== 1 ? 's' : ''}${hasMore ? '+' : ''}`}
          </span>
          <div className="watched-toggle">
            {watchedOptions.map(o => (
              <button
                key={o.value}
                className={`watched-toggle-btn ${watchedFilter === o.value ? 'active' : ''}`}
                onClick={() => setFilter({ watchedFilter: o.value })}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {movies.length === 0 && !loading ? (
          <div className="empty-state">
            <div className="empty-icon">🎞️</div>
            <div className="empty-title">No movies found</div>
            <div className="empty-sub">Try adjusting your filters or search</div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="movie-grid">
            {movies.map(m => <MovieCard key={m.id} movie={m} />)}
          </div>
        ) : (
          <div className="movie-list">
            {movies.map(m => <MovieRow key={m.id} movie={m} />)}
          </div>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} style={{ height: 1 }} />
        {loadingMore && (
          <div className="load-more-spinner">Loading more…</div>
        )}
      </div>
    </>
  )
}
