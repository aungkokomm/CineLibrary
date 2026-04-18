import { useStore } from '../store'
import MovieCard from '../components/MovieCard'
import MovieRow from '../components/MovieRow'
import FiltersBar from '../components/FiltersBar'

export default function LibraryPage() {
  const { movies, loading, viewMode } = useStore()

  return (
    <>
      <FiltersBar />

      <div className="library-body">
        <div className="library-header">
          <span className="library-count">
            {loading ? 'Loading...' : `${movies.length} movie${movies.length !== 1 ? 's' : ''}`}
          </span>
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
      </div>
    </>
  )
}
