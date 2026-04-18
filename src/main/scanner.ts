import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { Database } from 'better-sqlite3'
import { parseNfoFile, type ParsedMovie } from './nfo-parser'

const VIDEO_EXTS = ['.mkv', '.mp4', '.avi', '.m4v', '.mov', '.wmv', '.flv', '.webm', '.mpg', '.mpeg', '.ts', '.m2ts', '.iso']
const POSTER_NAMES = ['poster.jpg', 'poster.jpeg', 'poster.png', 'folder.jpg', 'cover.jpg']
const FANART_NAMES = ['fanart.jpg', 'fanart.jpeg', 'fanart.png', 'backdrop.jpg', 'backdrop.jpeg']
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png'])

export interface ScanProgress {
  phase: 'scanning' | 'parsing' | 'copying' | 'done'
  current: number
  total: number
  currentFile?: string
  added: number
  updated: number
  missing: number
  errors: number
}

export type ScanCallback = (p: ScanProgress) => void

/**
 * Walk a directory looking for .nfo files. Returns the nfo file path and
 * the folder containing it (which is treated as the movie's folder).
 */
function findNfoFiles(rootPath: string, callback: (nfoPath: string, folder: string) => void) {
  function walk(dir: string, depth = 0) {
    if (depth > 8) return  // safety limit for deeply nested drives
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch { return }

    // Prefer a "movie.nfo" or "<foldername>.nfo" in this folder
    let nfoInFolder: string | null = null
    for (const e of entries) {
      if (e.isFile() && e.name.toLowerCase().endsWith('.nfo')) {
        const full = path.join(dir, e.name)
        // Skip .actors / trailer nfos
        const lower = e.name.toLowerCase()
        if (lower.includes('tvshow') || lower.includes('season')) continue
        nfoInFolder = full
        if (lower === 'movie.nfo') break  // strongest match
      }
    }
    if (nfoInFolder) callback(nfoInFolder, dir)

    // Recurse into subfolders (even if we found an nfo - collections may have deeper structure)
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith('.') && e.name !== '$RECYCLE.BIN' && e.name !== 'System Volume Information') {
        walk(path.join(dir, e.name), depth + 1)
      }
    }
  }
  walk(rootPath)
}

/**
 * Find the video file in a movie folder (largest matching extension).
 */
function findVideoFile(folder: string): string | null {
  try {
    const files = fs.readdirSync(folder, { withFileTypes: true })
    let best: { path: string; size: number } | null = null
    for (const f of files) {
      if (!f.isFile()) continue
      const ext = path.extname(f.name).toLowerCase()
      if (!VIDEO_EXTS.includes(ext)) continue
      const full = path.join(folder, f.name)
      try {
        const size = fs.statSync(full).size
        if (!best || size > best.size) best = { path: full, size }
      } catch {}
    }
    return best?.path ?? null
  } catch { return null }
}

/**
 * Find poster/fanart in movie folder.
 */
function findArtwork(folder: string, names: string[], kind: 'poster' | 'fanart'): string | null {
  // 1. Check exact known names first
  for (const n of names) {
    const p = path.join(folder, n)
    if (fs.existsSync(p)) return p
  }
  // 2. Scan folder for MediaElch-style "<title>-poster.jpg" / "<title>-fanart.jpg"
  let entries: fs.Dirent[]
  try { entries = fs.readdirSync(folder, { withFileTypes: true }) } catch { return null }
  for (const e of entries) {
    if (!e.isFile()) continue
    const ext = path.extname(e.name).toLowerCase()
    if (!IMAGE_EXTS.has(ext)) continue
    const lower = e.name.toLowerCase()
    if (lower.includes(`-${kind}`) || lower.endsWith(`${kind}${ext}`)) {
      return path.join(folder, e.name)
    }
  }
  return null
}

/**
 * Copy a file to local cache, return the cache path (relative to dataDir).
 */
function copyToCache(srcPath: string, dataDir: string, movieKey: string, kind: 'poster'|'fanart'|'nfo'): string | null {
  try {
    const cacheDir = path.join(dataDir, 'cache', movieKey)
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })
    const ext = path.extname(srcPath) || (kind === 'nfo' ? '.nfo' : '.jpg')
    const destName = `${kind}${ext}`
    const destPath = path.join(cacheDir, destName)
    fs.copyFileSync(srcPath, destPath)
    // Return relative path from dataDir (so we stay portable)
    return path.join('cache', movieKey, destName).replace(/\\/g, '/')
  } catch (err) {
    console.error(`Failed to cache ${kind} for ${movieKey}:`, err)
    return null
  }
}

/**
 * Generate a stable movie key from drive serial + folder.
 */
function movieKey(volumeSerial: string, folderRelPath: string): string {
  const h = crypto.createHash('sha1').update(`${volumeSerial}|${folderRelPath}`).digest('hex')
  return h.slice(0, 16)
}

/**
 * Upsert a movie into the database along with all related metadata.
 */
function upsertMovie(
  db: Database,
  volumeSerial: string,
  folderRelPath: string,
  videoRelPath: string | null,
  parsed: ParsedMovie,
  localPoster: string | null,
  localFanart: string | null,
  localNfo: string | null
): { inserted: boolean; movieId: number } {
  // Check if exists
  const existing = db.prepare(
    'SELECT id FROM movies WHERE volume_serial = ? AND folder_rel_path = ?'
  ).get(volumeSerial, folderRelPath) as { id: number } | undefined

  let movieId: number
  let inserted = false

  if (existing) {
    movieId = existing.id
    db.prepare(`
      UPDATE movies SET
        video_file_rel_path = ?, title = ?, original_title = ?, sort_title = ?,
        year = ?, rating = ?, votes = ?, runtime = ?, plot = ?, outline = ?,
        tagline = ?, mpaa = ?, imdb_id = ?, tmdb_id = ?, premiered = ?,
        studio = ?, country = ?, trailer = ?, local_poster = ?, local_fanart = ?,
        local_nfo = ?, is_missing = 0, date_modified = strftime('%s','now')
      WHERE id = ?
    `).run(
      videoRelPath, parsed.title, parsed.originalTitle, parsed.sortTitle,
      parsed.year, parsed.rating, parsed.votes, parsed.runtime, parsed.plot, parsed.outline,
      parsed.tagline, parsed.mpaa, parsed.imdbId, parsed.tmdbId, parsed.premiered,
      parsed.studio, parsed.country, parsed.trailer, localPoster, localFanart,
      localNfo, movieId
    )
  } else {
    const result = db.prepare(`
      INSERT INTO movies (
        volume_serial, folder_rel_path, video_file_rel_path, title, original_title, sort_title,
        year, rating, votes, runtime, plot, outline, tagline, mpaa, imdb_id, tmdb_id,
        premiered, studio, country, trailer, local_poster, local_fanart, local_nfo
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      volumeSerial, folderRelPath, videoRelPath, parsed.title, parsed.originalTitle, parsed.sortTitle,
      parsed.year, parsed.rating, parsed.votes, parsed.runtime, parsed.plot, parsed.outline,
      parsed.tagline, parsed.mpaa, parsed.imdbId, parsed.tmdbId, parsed.premiered,
      parsed.studio, parsed.country, parsed.trailer, localPoster, localFanart, localNfo
    )
    movieId = result.lastInsertRowid as number
    inserted = true
  }

  // Replace all related tags (simpler than diffing)
  db.prepare('DELETE FROM movie_genres WHERE movie_id = ?').run(movieId)
  db.prepare('DELETE FROM movie_directors WHERE movie_id = ?').run(movieId)
  db.prepare('DELETE FROM movie_actors WHERE movie_id = ?').run(movieId)
  db.prepare('DELETE FROM movie_sets WHERE movie_id = ?').run(movieId)

  const insGenre = db.prepare('INSERT OR IGNORE INTO genres (name) VALUES (?)')
  const getGenre = db.prepare('SELECT id FROM genres WHERE name = ?')
  const linkGenre = db.prepare('INSERT OR IGNORE INTO movie_genres (movie_id, genre_id) VALUES (?, ?)')
  for (const g of parsed.genres) {
    insGenre.run(g)
    const row = getGenre.get(g) as { id: number }
    linkGenre.run(movieId, row.id)
  }

  const insDir = db.prepare('INSERT OR IGNORE INTO directors (name) VALUES (?)')
  const getDir = db.prepare('SELECT id FROM directors WHERE name = ?')
  const linkDir = db.prepare('INSERT OR IGNORE INTO movie_directors (movie_id, director_id) VALUES (?, ?)')
  for (const d of parsed.directors) {
    insDir.run(d)
    const row = getDir.get(d) as { id: number }
    linkDir.run(movieId, row.id)
  }

  const insActor = db.prepare('INSERT OR IGNORE INTO actors (name, thumb) VALUES (?, ?)')
  const getActor = db.prepare('SELECT id FROM actors WHERE name = ?')
  const linkActor = db.prepare('INSERT OR REPLACE INTO movie_actors (movie_id, actor_id, role, sort_order) VALUES (?, ?, ?, ?)')
  parsed.actors.forEach((a, idx) => {
    insActor.run(a.name, a.thumb || null)
    const row = getActor.get(a.name) as { id: number }
    linkActor.run(movieId, row.id, a.role || null, a.order ?? idx)
  })

  const insSet = db.prepare('INSERT OR IGNORE INTO sets (name) VALUES (?)')
  const getSet = db.prepare('SELECT id FROM sets WHERE name = ?')
  const linkSet = db.prepare('INSERT OR IGNORE INTO movie_sets (movie_id, set_id) VALUES (?, ?)')
  for (const s of parsed.sets) {
    insSet.run(s)
    const row = getSet.get(s) as { id: number }
    linkSet.run(movieId, row.id)
  }

  return { inserted, movieId }
}

/**
 * Main scan entry point. Scans a drive's movie root, imports all found movies,
 * marks missing movies as missing (keeps metadata - never auto-deletes user data).
 */
export function scanDrive(
  db: Database,
  dataDir: string,
  volumeSerial: string,
  driveLetter: string,
  movieRootsRelative: string[],
  onProgress?: ScanCallback
): ScanProgress {
  const driveRoot = driveLetter.endsWith(':') ? driveLetter + '\\' : driveLetter

  const progress: ScanProgress = {
    phase: 'scanning', current: 0, total: 0,
    added: 0, updated: 0, missing: 0, errors: 0
  }

  // Phase 1: find all NFO files across all roots
  const nfoItems: Array<{ nfoPath: string; folder: string }> = []
  for (const root of movieRootsRelative) {
    const fullScanRoot = path.join(driveRoot, root)
    findNfoFiles(fullScanRoot, (nfoPath, folder) => {
      nfoItems.push({ nfoPath, folder })
    })
  }
  progress.total = nfoItems.length
  progress.phase = 'parsing'
  onProgress?.(progress)

  // Track which movies we see so we can mark missing ones
  const seenFolders = new Set<string>()

  // Phase 2: parse NFOs outside transactions (file I/O), then batch-commit every 50
  const BATCH = 50
  type ParsedItem = {
    folderRelPath: string; videoRelPath: string | null
    parsed: ReturnType<typeof parseNfoFile>
    localPoster: string | null; localFanart: string | null; localNfo: string | null
  }

  const commitBatch = db.transaction((batch: ParsedItem[]) => {
    for (const item of batch) {
      if (!item.parsed) { progress.errors++; continue }
      seenFolders.add(item.folderRelPath)
      const { inserted } = upsertMovie(
        db, volumeSerial, item.folderRelPath, item.videoRelPath, item.parsed,
        item.localPoster, item.localFanart, item.localNfo
      )
      if (inserted) progress.added++
      else progress.updated++
    }
  })

  let batch: ParsedItem[] = []

  for (let i = 0; i < nfoItems.length; i++) {
    const { nfoPath, folder } = nfoItems[i]
    progress.current = i + 1
    progress.currentFile = path.basename(folder)

    const parsed = parseNfoFile(nfoPath)
    const folderRelPath = path.relative(driveRoot, folder).replace(/\\/g, '/')
    const video = findVideoFile(folder)
    const videoRelPath = video ? path.relative(driveRoot, video).replace(/\\/g, '/') : null
    const key = movieKey(volumeSerial, folderRelPath)
    const posterSrc = findArtwork(folder, POSTER_NAMES, 'poster')
    const fanartSrc = findArtwork(folder, FANART_NAMES, 'fanart')

    batch.push({
      folderRelPath, videoRelPath, parsed,
      localPoster: posterSrc ? copyToCache(posterSrc, dataDir, key, 'poster') : null,
      localFanart: fanartSrc ? copyToCache(fanartSrc, dataDir, key, 'fanart') : null,
      localNfo:    copyToCache(nfoPath, dataDir, key, 'nfo')
    })

    if (batch.length === BATCH || i === nfoItems.length - 1) {
      try { commitBatch(batch) } catch (err) {
        console.error('Batch commit failed:', err)
        progress.errors += batch.length
      }
      batch = []
      onProgress?.(progress)
    }
  }

  // Phase 3: mark missing movies (keep them in DB - never auto-delete)
  const existingMovies = db.prepare(
    'SELECT id, folder_rel_path FROM movies WHERE volume_serial = ? AND is_missing = 0'
  ).all(volumeSerial) as Array<{ id: number; folder_rel_path: string }>

  const markMissing = db.prepare('UPDATE movies SET is_missing = 1 WHERE id = ?')
  const markPresent = db.prepare('UPDATE movies SET is_missing = 0 WHERE id = ?')
  for (const m of existingMovies) {
    if (!seenFolders.has(m.folder_rel_path)) {
      markMissing.run(m.id)
      progress.missing++
    } else {
      markPresent.run(m.id)
    }
  }
  // Also un-mark missing any movie we just found
  const markSeenPresent = db.prepare(`
    UPDATE movies SET is_missing = 0
    WHERE volume_serial = ? AND folder_rel_path = ?
  `)
  for (const folder of seenFolders) {
    markSeenPresent.run(volumeSerial, folder)
  }

  progress.phase = 'done'
  onProgress?.(progress)
  return progress
}
