import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import type { Database } from 'better-sqlite3'
import {
  detectDriveForPath,
  scanAllConnectedDrives,
  findCurrentLetterForSerial,
  resolveMoviePath
} from './drives'
import { scanDrive } from './scanner'

export function registerIpcHandlers(db: Database, dataDir: string) {

  // ─── DRIVES ────────────────────────────────────────────────────────

  ipcMain.handle('drives:list', () => {
    const drives = db.prepare(`
      SELECT d.*,
        (SELECT COUNT(*) FROM movies m WHERE m.volume_serial = d.volume_serial) as movie_count,
        (SELECT COUNT(*) FROM movies m WHERE m.volume_serial = d.volume_serial AND m.is_missing = 1) as missing_count
      FROM drives d
      ORDER BY d.label
    `).all() as any[]

    // Fetch all roots in one query, group by drive
    const allRoots = db.prepare('SELECT id, volume_serial, root_path FROM drive_roots ORDER BY root_path').all() as any[]
    const rootsByDrive = new Map<string, any[]>()
    for (const r of allRoots) {
      if (!rootsByDrive.has(r.volume_serial)) rootsByDrive.set(r.volume_serial, [])
      rootsByDrive.get(r.volume_serial)!.push({ id: r.id, root_path: r.root_path })
    }

    const connected = scanAllConnectedDrives()
    const connectedSerials = new Set(connected.map(d => d.volumeSerial))
    return drives.map(d => ({
      ...d,
      roots: rootsByDrive.get(d.volume_serial) ?? [],
      is_connected: connectedSerials.has(d.volume_serial),
      current_letter: connected.find(c => c.volumeSerial === d.volume_serial)?.letter || null
    }))
  })

  ipcMain.handle('drives:add', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win!, {
      title: 'Select the root folder containing your movies',
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const folderPath = result.filePaths[0]
    const detected = detectDriveForPath(folderPath)
    if (!detected) {
      return { error: 'Could not detect drive information for this path' }
    }

    const driveRoot = path.parse(folderPath).root
    const movieRootRelative = path.relative(driveRoot, folderPath).replace(/\\/g, '/')

    // Check if already registered
    const existing = db.prepare('SELECT * FROM drives WHERE volume_serial = ?').get(detected.volumeSerial)
    if (existing) {
      return { error: 'This drive is already registered', existing }
    }

    // Generate default label
    const defaultLabel = detected.volumeName && detected.volumeName.length > 0
      ? detected.volumeName
      : `Drive ${detected.letter}`

    db.prepare(`
      INSERT INTO drives (volume_serial, label, last_seen_letter, last_connected_at, movie_root_relative)
      VALUES (?, ?, ?, strftime('%s','now'), ?)
    `).run(detected.volumeSerial, defaultLabel, detected.letter, movieRootRelative)

    db.prepare('INSERT OR IGNORE INTO drive_roots (volume_serial, root_path) VALUES (?, ?)')
      .run(detected.volumeSerial, movieRootRelative)

    return {
      volume_serial: detected.volumeSerial,
      label: defaultLabel,
      movie_root_relative: movieRootRelative,
      letter: detected.letter
    }
  })

  ipcMain.handle('drives:addRoot', async (event, volumeSerial: string) => {
    const drive = db.prepare('SELECT * FROM drives WHERE volume_serial = ?').get(volumeSerial) as any
    if (!drive) return { error: 'Drive not registered' }

    const letter = findCurrentLetterForSerial(volumeSerial)
    if (!letter) return { error: 'Drive must be connected to add a folder' }

    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win!, {
      title: 'Select a folder on this drive to add',
      defaultPath: letter + '\\',
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const folderPath = result.filePaths[0]
    const detected = detectDriveForPath(folderPath)
    if (!detected || detected.volumeSerial !== volumeSerial) {
      return { error: 'Selected folder is not on this drive' }
    }

    const driveRoot = path.parse(folderPath).root
    const rootRelative = path.relative(driveRoot, folderPath).replace(/\\/g, '/')

    const existing = db.prepare('SELECT id FROM drive_roots WHERE volume_serial = ? AND root_path = ?').get(volumeSerial, rootRelative)
    if (existing) return { error: 'This folder is already added' }

    db.prepare('INSERT INTO drive_roots (volume_serial, root_path) VALUES (?, ?)').run(volumeSerial, rootRelative)
    return { success: true, root_path: rootRelative }
  })

  ipcMain.handle('drives:removeRoot', (_e, volumeSerial: string, rootId: number) => {
    const roots = db.prepare('SELECT COUNT(*) as c FROM drive_roots WHERE volume_serial = ?').get(volumeSerial) as any
    if (roots.c <= 1) return { error: 'Cannot remove the last folder — add another first' }
    db.prepare('DELETE FROM drive_roots WHERE id = ? AND volume_serial = ?').run(rootId, volumeSerial)
    return { success: true }
  })

  ipcMain.handle('drives:rename', (_e, volumeSerial: string, newLabel: string) => {
    if (!newLabel || !newLabel.trim()) return { error: 'Label cannot be empty' }
    db.prepare('UPDATE drives SET label = ? WHERE volume_serial = ?').run(newLabel.trim(), volumeSerial)
    return { success: true }
  })

  ipcMain.handle('drives:remove', (_e, volumeSerial: string) => {
    // Cascade deletes movies and cache directories
    const movies = db.prepare('SELECT local_poster, local_fanart, local_nfo FROM movies WHERE volume_serial = ?')
      .all(volumeSerial) as Array<{ local_poster?: string; local_fanart?: string; local_nfo?: string }>

    // Remove cache files
    for (const m of movies) {
      for (const f of [m.local_poster, m.local_fanart, m.local_nfo]) {
        if (f) {
          try {
            const fullPath = path.join(dataDir, f)
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
            // Remove empty parent dir
            const dir = path.dirname(fullPath)
            if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir)
          } catch {}
        }
      }
    }
    db.prepare('DELETE FROM drives WHERE volume_serial = ?').run(volumeSerial)
    return { success: true }
  })

  ipcMain.handle('drives:scan', async (event, volumeSerial: string) => {
    const drive = db.prepare('SELECT * FROM drives WHERE volume_serial = ?').get(volumeSerial) as any
    if (!drive) return { error: 'Drive not registered' }

    const letter = findCurrentLetterForSerial(volumeSerial)
    if (!letter) return { error: 'Drive is not currently connected' }

    // Update last seen
    db.prepare('UPDATE drives SET last_seen_letter = ?, last_connected_at = strftime(\'%s\',\'now\') WHERE volume_serial = ?')
      .run(letter, volumeSerial)

    const roots = (db.prepare('SELECT root_path FROM drive_roots WHERE volume_serial = ?').all(volumeSerial) as any[]).map(r => r.root_path)
    if (roots.length === 0) return { error: 'No folders configured for this drive' }

    const win = BrowserWindow.fromWebContents(event.sender)
    const progress = scanDrive(db, dataDir, volumeSerial, letter, roots, (p) => {
      win?.webContents.send('scan:progress', { volumeSerial, ...p })
    })
    return progress
  })

  // ─── MOVIES ────────────────────────────────────────────────────────

  ipcMain.handle('movies:list', (_e, opts: {
    search?: string
    sort?: string
    sortDir?: 'asc' | 'desc'
    genre?: string
    director?: string
    actor?: string
    year?: number
    driveSerial?: string
    showMissing?: boolean
    favoritesOnly?: boolean
    limit?: number
    offset?: number
  } = {}) => {
    const {
      search, sort = 'sort_title', sortDir = 'asc',
      genre, director, actor, year, driveSerial,
      showMissing = true, favoritesOnly = false,
      limit = 1000, offset = 0
    } = opts

    const where: string[] = []
    const params: any[] = []

    if (!showMissing) where.push('m.is_missing = 0')
    if (favoritesOnly) where.push('m.is_favorite = 1')
    if (year) { where.push('m.year = ?'); params.push(year) }
    if (driveSerial) { where.push('m.volume_serial = ?'); params.push(driveSerial) }

    if (genre) {
      where.push('m.id IN (SELECT mg.movie_id FROM movie_genres mg JOIN genres g ON g.id = mg.genre_id WHERE g.name = ?)')
      params.push(genre)
    }
    if (director) {
      where.push('m.id IN (SELECT md.movie_id FROM movie_directors md JOIN directors d ON d.id = md.director_id WHERE d.name = ?)')
      params.push(director)
    }
    if (actor) {
      where.push('m.id IN (SELECT ma.movie_id FROM movie_actors ma JOIN actors a ON a.id = ma.actor_id WHERE a.name = ?)')
      params.push(actor)
    }
    if (search && search.trim()) {
      // Use FTS + actor/director LIKE for broader coverage
      const fts = search.trim().replace(/['"]/g, '').split(/\s+/).map(t => `${t}*`).join(' ')
      where.push(`(m.id IN (SELECT rowid FROM movies_fts WHERE movies_fts MATCH ?)
                  OR m.id IN (SELECT ma.movie_id FROM movie_actors ma JOIN actors a ON a.id = ma.actor_id WHERE a.name LIKE ?)
                  OR m.id IN (SELECT md.movie_id FROM movie_directors md JOIN directors d ON d.id = md.director_id WHERE d.name LIKE ?))`)
      params.push(fts, `%${search}%`, `%${search}%`)
    }

    const SORT_MAP: Record<string, string> = {
      title: 'm.sort_title',
      year: 'm.year',
      rating: 'm.rating',
      runtime: 'm.runtime',
      date_added: 'm.date_added'
    }
    const sortCol = SORT_MAP[sort] || 'm.sort_title'
    const sortSql = sortDir.toLowerCase() === 'desc' ? 'DESC' : 'ASC'

    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const query = `
      SELECT
        m.id, m.title, m.year, m.rating, m.runtime, m.tagline,
        m.local_poster, m.is_missing, m.is_favorite,
        m.volume_serial,
        d.label as drive_label,
        (SELECT GROUP_CONCAT(g.name, ', ') FROM movie_genres mg JOIN genres g ON g.id = mg.genre_id WHERE mg.movie_id = m.id) as genres_csv
      FROM movies m
      LEFT JOIN drives d ON d.volume_serial = m.volume_serial
      ${whereSql}
      ORDER BY ${sortCol} ${sortSql} NULLS LAST, m.sort_title ASC
      LIMIT ? OFFSET ?
    `
    params.push(limit, offset)
    return db.prepare(query).all(...params)
  })

  ipcMain.handle('movies:detail', (_e, id: number) => {
    const movie = db.prepare(`
      SELECT m.*, d.label as drive_label
      FROM movies m
      LEFT JOIN drives d ON d.volume_serial = m.volume_serial
      WHERE m.id = ?
    `).get(id) as any
    if (!movie) return null

    movie.genres = db.prepare('SELECT g.name FROM genres g JOIN movie_genres mg ON mg.genre_id = g.id WHERE mg.movie_id = ? ORDER BY g.name').all(id).map((r: any) => r.name)
    movie.directors = db.prepare('SELECT d.name FROM directors d JOIN movie_directors md ON md.director_id = d.id WHERE md.movie_id = ?').all(id).map((r: any) => r.name)
    movie.actors = db.prepare(`
      SELECT a.name, a.thumb, ma.role, ma.sort_order
      FROM actors a JOIN movie_actors ma ON ma.actor_id = a.id
      WHERE ma.movie_id = ? ORDER BY ma.sort_order ASC
    `).all(id)
    movie.sets = db.prepare('SELECT s.name FROM sets s JOIN movie_sets ms ON ms.set_id = s.id WHERE ms.movie_id = ?').all(id).map((r: any) => r.name)

    // Check if drive is connected and file exists
    movie.current_letter = findCurrentLetterForSerial(movie.volume_serial)
    if (movie.current_letter && movie.video_file_rel_path) {
      const fullPath = path.join(movie.current_letter + '\\', movie.video_file_rel_path)
      movie.playable = fs.existsSync(fullPath)
    } else {
      movie.playable = false
    }
    return movie
  })

  ipcMain.handle('movies:toggleFavorite', (_e, id: number) => {
    db.prepare('UPDATE movies SET is_favorite = 1 - is_favorite WHERE id = ?').run(id)
    return db.prepare('SELECT is_favorite FROM movies WHERE id = ?').get(id)
  })

  ipcMain.handle('movies:play', (_e, id: number) => {
    const movie = db.prepare('SELECT volume_serial, video_file_rel_path FROM movies WHERE id = ?').get(id) as any
    if (!movie?.video_file_rel_path) return { error: 'No video file registered for this movie' }
    const fullPath = resolveMoviePath(movie.volume_serial, movie.video_file_rel_path)
    if (!fullPath) return { error: 'Drive not connected' }
    shell.openPath(fullPath).then(err => { if (err) console.error('Play error:', err) })
    db.prepare('UPDATE movies SET play_count = play_count + 1, last_played_at = strftime(\'%s\',\'now\') WHERE id = ?').run(id)
    return { success: true, path: fullPath }
  })

  ipcMain.handle('movies:openFolder', (_e, id: number) => {
    const movie = db.prepare('SELECT volume_serial, folder_rel_path FROM movies WHERE id = ?').get(id) as any
    if (!movie) return { error: 'Movie not found' }
    const letter = findCurrentLetterForSerial(movie.volume_serial)
    if (!letter) return { error: 'Drive not connected' }
    const fullPath = path.join(letter + '\\', movie.folder_rel_path)
    shell.openPath(fullPath)
    return { success: true }
  })

  ipcMain.handle('movies:removeMissing', (_e, driveSerial?: string) => {
    let result: any
    if (driveSerial) {
      result = db.prepare('DELETE FROM movies WHERE is_missing = 1 AND volume_serial = ?').run(driveSerial)
    } else {
      result = db.prepare('DELETE FROM movies WHERE is_missing = 1').run()
    }
    return { deleted: result.changes }
  })

  // ─── FACETS (for filters) ─────────────────────────────────────────
  // Each dimension excludes its OWN filter so you can see alternatives,
  // but respects ALL other active filters (contextual / cross-filtering).

  ipcMain.handle('facets:all', (_e, filters: {
    genre?: string; director?: string; actor?: string
    year?: number; driveSerial?: string; showMissing?: boolean
  } = {}) => {
    function baseIds(exclude: 'genre'|'director'|'actor'|'year'|'drive'): { sql: string; params: any[] } {
      const where: string[] = []
      const params: any[] = []
      if (filters.showMissing === false) where.push('m.is_missing = 0')
      if (exclude !== 'year'     && filters.year)        { where.push('m.year = ?');           params.push(filters.year) }
      if (exclude !== 'drive'    && filters.driveSerial) { where.push('m.volume_serial = ?');  params.push(filters.driveSerial) }
      if (exclude !== 'genre'    && filters.genre) {
        where.push('m.id IN (SELECT mg2.movie_id FROM movie_genres mg2 JOIN genres g2 ON g2.id=mg2.genre_id WHERE g2.name=?)')
        params.push(filters.genre)
      }
      if (exclude !== 'director' && filters.director) {
        where.push('m.id IN (SELECT md2.movie_id FROM movie_directors md2 JOIN directors d2 ON d2.id=md2.director_id WHERE d2.name=?)')
        params.push(filters.director)
      }
      if (exclude !== 'actor'    && filters.actor) {
        where.push('m.id IN (SELECT ma2.movie_id FROM movie_actors ma2 JOIN actors a2 ON a2.id=ma2.actor_id WHERE a2.name=?)')
        params.push(filters.actor)
      }
      const w = where.length ? 'WHERE ' + where.join(' AND ') : ''
      return { sql: `SELECT m.id FROM movies m ${w}`, params }
    }

    const gBase = baseIds('genre')
    const dBase = baseIds('director')
    const aBase = baseIds('actor')
    const yBase = baseIds('year')

    return {
      genres: db.prepare(`
        SELECT g.name, COUNT(*) as count FROM genres g
        JOIN movie_genres mg ON mg.genre_id = g.id
        WHERE mg.movie_id IN (${gBase.sql})
        GROUP BY g.name ORDER BY count DESC, g.name
      `).all(...gBase.params) as any[],
      directors: db.prepare(`
        SELECT d.name, COUNT(*) as count FROM directors d
        JOIN movie_directors md ON md.director_id = d.id
        WHERE md.movie_id IN (${dBase.sql})
        GROUP BY d.name ORDER BY count DESC, d.name LIMIT 200
      `).all(...dBase.params) as any[],
      actors: db.prepare(`
        SELECT a.name, COUNT(*) as count FROM actors a
        JOIN movie_actors ma ON ma.actor_id = a.id
        WHERE ma.movie_id IN (${aBase.sql})
        GROUP BY a.name ORDER BY count DESC, a.name LIMIT 500
      `).all(...aBase.params) as any[],
      years: (db.prepare(`
        SELECT DISTINCT year FROM movies m
        WHERE year IS NOT NULL AND m.id IN (${yBase.sql})
        ORDER BY year DESC
      `).all(...yBase.params) as any[]).map((r: any) => r.year)
    }
  })

  ipcMain.handle('stats:overview', () => {
    const totalMovies = (db.prepare('SELECT COUNT(*) as c FROM movies WHERE is_missing = 0').get() as any).c
    const totalMissing = (db.prepare('SELECT COUNT(*) as c FROM movies WHERE is_missing = 1').get() as any).c
    const totalRuntime = (db.prepare('SELECT COALESCE(SUM(runtime),0) as t FROM movies WHERE is_missing = 0').get() as any).t
    const avgRating = (db.prepare('SELECT AVG(rating) as r FROM movies WHERE is_missing = 0 AND rating IS NOT NULL').get() as any).r
    const totalGenres = (db.prepare('SELECT COUNT(*) as c FROM genres').get() as any).c
    const totalDrives = (db.prepare('SELECT COUNT(*) as c FROM drives').get() as any).c
    return { totalMovies, totalMissing, totalRuntime, avgRating, totalGenres, totalDrives }
  })

  // ─── CACHE ─────────────────────────────────────────────────────────

  ipcMain.handle('cache:getImage', (_e, relPath: string) => {
    if (!relPath) return null
    const fullPath = path.join(dataDir, relPath)
    if (!fs.existsSync(fullPath)) return null
    try {
      const buf = fs.readFileSync(fullPath)
      const ext = path.extname(fullPath).slice(1).toLowerCase() || 'jpg'
      return `data:image/${ext};base64,${buf.toString('base64')}`
    } catch { return null }
  })
}
