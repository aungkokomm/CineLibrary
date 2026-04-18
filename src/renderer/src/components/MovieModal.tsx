import { useEffect, useState } from 'react'
import { useStore } from '../store'
import type { MovieDetail } from '../api'
import CachedImage from './CachedImage'

export default function MovieModal() {
  const { openMovieId, setOpenMovieId, setFilter, setPage, loadMovies } = useStore()
  const [movie, setMovie] = useState<MovieDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (openMovieId == null) { setMovie(null); return }
    setLoading(true)
    window.api.movies.detail(openMovieId).then(m => {
      setMovie(m)
      setLoading(false)
    })
  }, [openMovieId])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenMovieId(null)
    }
    if (openMovieId != null) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [openMovieId])

  if (openMovieId == null) return null

  async function play() {
    if (!movie) return
    const result = await window.api.movies.play(movie.id)
    if (result?.error) alert(result.error)
  }

  async function openFolder() {
    if (!movie) return
    const result = await window.api.movies.openFolder(movie.id)
    if (result?.error) alert(result.error)
  }

  async function toggleFavorite() {
    if (!movie) return
    await window.api.movies.toggleFavorite(movie.id)
    const updated = await window.api.movies.detail(movie.id)
    setMovie(updated)
    loadMovies()
  }

  function filterByActor(name: string) {
    setOpenMovieId(null)
    setPage('library')
    setFilter({ actor: name })
  }
  function filterByDirector(name: string) {
    setOpenMovieId(null)
    setPage('library')
    setFilter({ director: name })
  }
  function filterByGenre(name: string) {
    setOpenMovieId(null)
    setPage('library')
    setFilter({ genre: name })
  }

  return (
    <div className="modal-backdrop" onClick={() => setOpenMovieId(null)}>
      <div className="modal scale-in" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={() => setOpenMovieId(null)}>✕</button>

        {loading ? (
          <div style={{ padding: 80, textAlign: 'center', color: 'var(--muted)' }}>Loading...</div>
        ) : !movie ? (
          <div style={{ padding: 80, textAlign: 'center', color: 'var(--muted)' }}>Movie not found</div>
        ) : (
          <>
            {/* Hero backdrop */}
            <div className="modal-hero">
              <CachedImage
                relPath={movie.local_fanart}
                alt=""
                className="modal-hero-img"
                fallback={<div className="modal-hero-gradient" />}
              />
              <div className="modal-hero-overlay" />
            </div>

            <div className="modal-body">
              <div className="modal-top">
                <div className="modal-poster-wrap">
                  <CachedImage
                    relPath={movie.local_poster}
                    alt={movie.title}
                    className="modal-poster-img"
                    fallback={<div className="modal-poster-fallback">🎬</div>}
                  />
                </div>
                <div className="modal-meta-col">
                  <h1 className="modal-title">{movie.title}</h1>
                  {movie.original_title && movie.original_title !== movie.title && (
                    <div className="modal-original">{movie.original_title}</div>
                  )}
                  {movie.tagline && <div className="modal-tagline">"{movie.tagline}"</div>}

                  <div className="modal-chips">
                    {movie.year && <span className="modal-chip">{movie.year}</span>}
                    {movie.runtime && <span className="modal-chip">{movie.runtime} min</span>}
                    {movie.mpaa && <span className="modal-chip">{movie.mpaa}</span>}
                    {movie.rating ? <span className="modal-chip accent">★ {movie.rating.toFixed(1)}</span> : null}
                    {movie.is_missing ? <span className="modal-chip danger">MISSING</span> : null}
                  </div>

                  <div className="modal-location">
                    <span className="modal-location-label">Located on:</span>
                    <span className="modal-location-drive">
                      <span className={`drive-dot ${movie.current_letter ? 'online' : 'offline'}`} />
                      {movie.drive_label}
                      {movie.current_letter && <span className="drive-letter">{movie.current_letter}</span>}
                    </span>
                  </div>

                  <div className="modal-actions">
                    {movie.playable ? (
                      <button className="btn btn-primary" onClick={play}>▶ Play</button>
                    ) : (
                      <button className="btn btn-outline" disabled>
                        🔌 Plug in "{movie.drive_label}"
                      </button>
                    )}
                    <button
                      className="btn btn-outline"
                      onClick={openFolder}
                      disabled={!movie.current_letter}
                    >
                      📂 Open Folder
                    </button>
                    <button className="btn btn-outline" onClick={toggleFavorite}>
                      {movie.is_favorite ? '★ Favorited' : '☆ Favorite'}
                    </button>
                  </div>
                </div>
              </div>

              {movie.plot && (
                <div className="modal-section">
                  <h3 className="modal-section-title">Plot</h3>
                  <p className="modal-plot">{movie.plot}</p>
                </div>
              )}

              <div className="modal-grid">
                {movie.genres?.length > 0 && (
                  <div className="modal-field">
                    <label>Genres</label>
                    <div className="modal-links">
                      {movie.genres.map(g => (
                        <button key={g} className="modal-link" onClick={() => filterByGenre(g)}>{g}</button>
                      ))}
                    </div>
                  </div>
                )}
                {movie.directors?.length > 0 && (
                  <div className="modal-field">
                    <label>Director{movie.directors.length > 1 ? 's' : ''}</label>
                    <div className="modal-links">
                      {movie.directors.map(d => (
                        <button key={d} className="modal-link" onClick={() => filterByDirector(d)}>{d}</button>
                      ))}
                    </div>
                  </div>
                )}
                {movie.studio && (
                  <div className="modal-field">
                    <label>Studio</label>
                    <p>{movie.studio}</p>
                  </div>
                )}
                {movie.country && (
                  <div className="modal-field">
                    <label>Country</label>
                    <p>{movie.country}</p>
                  </div>
                )}
                {movie.premiered && (
                  <div className="modal-field">
                    <label>Released</label>
                    <p>{movie.premiered}</p>
                  </div>
                )}
                {movie.imdb_id && (
                  <div className="modal-field">
                    <label>IMDB</label>
                    <p className="modal-mono">{movie.imdb_id}</p>
                  </div>
                )}
              </div>

              {movie.actors?.length > 0 && (
                <div className="modal-section">
                  <h3 className="modal-section-title">Cast</h3>
                  <div className="modal-cast">
                    {movie.actors.slice(0, 12).map(a => (
                      <button
                        key={a.name}
                        className="modal-cast-item"
                        onClick={() => filterByActor(a.name)}
                      >
                        <div className="modal-cast-name">{a.name}</div>
                        {a.role && <div className="modal-cast-role">{a.role}</div>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
