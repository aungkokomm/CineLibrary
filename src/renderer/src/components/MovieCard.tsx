import { memo } from 'react'
import type { MovieListItem } from '../api'
import { useStore } from '../store'
import CachedImage from './CachedImage'

interface Props { movie: MovieListItem }

function MovieCard({ movie }: Props) {
  const setOpenMovieId = useStore(s => s.setOpenMovieId)
  const drives = useStore(s => s.drives)
  const drive = drives.find(d => d.volume_serial === movie.volume_serial)
  const isOffline = drive ? !drive.is_connected : true

  return (
    <div
      className="movie-card"
      onClick={() => setOpenMovieId(movie.id)}
    >
      <div className="movie-poster">
        <CachedImage
          relPath={movie.local_poster}
          alt={movie.title}
          className="poster-img"
          fallback={
            <div className="poster-placeholder">
              <span className="poster-placeholder-icon">🎬</span>
              <span className="poster-placeholder-title">{movie.title}</span>
            </div>
          }
        />

        {movie.is_missing ? (
          <div className="poster-badge poster-badge-missing">MISSING</div>
        ) : isOffline ? (
          <div className="poster-badge poster-badge-offline">OFFLINE</div>
        ) : null}

        {movie.is_favorite ? (
          <div className="poster-badge poster-badge-fav">★</div>
        ) : null}

        {movie.is_watched ? (
          <div className="poster-watched-tick" title="Watched">✓</div>
        ) : null}

        {movie.rating ? (
          <div className="poster-rating">★ {movie.rating.toFixed(1)}</div>
        ) : null}

        <div className="poster-overlay">
          <div className="poster-overlay-inner">
            <div className="poster-overlay-genres">
              {(movie.genres_csv || '').split(',').slice(0, 3).map(g => g.trim()).filter(Boolean).join(' · ')}
            </div>
            <button className="btn btn-primary btn-sm poster-overlay-btn">
              View Details
            </button>
          </div>
        </div>
      </div>

      <div className="movie-info">
        <div className="movie-title" title={movie.title}>{movie.title}</div>
        <div className="movie-meta">
          <span>{movie.year || '—'}</span>
          {movie.runtime ? <span>· {movie.runtime}m</span> : null}
          {drive && <span className="movie-drive" title={drive.label}>· {drive.label}</span>}
        </div>
      </div>
    </div>
  )
}

export default memo(MovieCard)
