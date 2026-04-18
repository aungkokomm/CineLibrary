import { memo } from 'react'
import type { MovieListItem } from '../api'
import { useStore } from '../store'
import CachedImage from './CachedImage'

interface Props { movie: MovieListItem }

function MovieRow({ movie }: Props) {
  const setOpenMovieId = useStore(s => s.setOpenMovieId)
  const drives = useStore(s => s.drives)
  const drive = drives.find(d => d.volume_serial === movie.volume_serial)

  async function toggleFav(e: React.MouseEvent) {
    e.stopPropagation()
    await window.api.movies.toggleFavorite(movie.id)
    useStore.getState().loadMovies()
  }

  return (
    <div className="movie-row" onClick={() => setOpenMovieId(movie.id)}>
      <div className="movie-row-thumb">
        <CachedImage
          relPath={movie.local_poster}
          alt={movie.title}
          className="row-thumb-img"
          fallback={<div className="row-thumb-placeholder">🎬</div>}
        />
      </div>
      <div className="movie-row-main">
        <div className="movie-row-title">
          {movie.title}
          {movie.is_favorite ? <span className="movie-row-fav">★</span> : null}
        </div>
        <div className="movie-row-meta">
          {movie.year || '—'}
          {movie.runtime ? ` · ${movie.runtime}m` : ''}
          {movie.genres_csv ? ` · ${movie.genres_csv}` : ''}
        </div>
        {drive && (
          <div className="movie-row-drive">
            <span className={`drive-dot ${drive.is_connected ? 'online' : 'offline'}`} />
            {drive.label}
          </div>
        )}
      </div>
      <div className="movie-row-rating">
        {movie.rating ? `★ ${movie.rating.toFixed(1)}` : '—'}
      </div>
      <div className="movie-row-status">
        {movie.is_missing ? (
          <span className="status-badge missing">MISSING</span>
        ) : drive?.is_connected ? (
          <span className="status-badge online">ONLINE</span>
        ) : (
          <span className="status-badge offline">OFFLINE</span>
        )}
      </div>
      <div className="movie-row-actions" onClick={e => e.stopPropagation()}>
        <button className="row-action-btn" title="Favorite" onClick={toggleFav}>
          {movie.is_favorite ? '★' : '☆'}
        </button>
      </div>
    </div>
  )
}

export default memo(MovieRow)
