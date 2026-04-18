import Database from 'better-sqlite3'
import type { Database as DB } from 'better-sqlite3'

export function initDatabase(dbPath: string): DB {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Drives table - identified internally by volume_serial, user sees only 'label'
  db.exec(`
    CREATE TABLE IF NOT EXISTS drives (
      volume_serial TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      last_seen_letter TEXT,
      last_connected_at INTEGER,
      movie_root_relative TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS movies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      volume_serial TEXT NOT NULL,
      folder_rel_path TEXT NOT NULL,
      video_file_rel_path TEXT,
      title TEXT NOT NULL,
      original_title TEXT,
      sort_title TEXT,
      year INTEGER,
      rating REAL,
      votes INTEGER,
      runtime INTEGER,
      plot TEXT,
      outline TEXT,
      tagline TEXT,
      mpaa TEXT,
      imdb_id TEXT,
      tmdb_id TEXT,
      premiered TEXT,
      studio TEXT,
      country TEXT,
      trailer TEXT,
      local_poster TEXT,
      local_fanart TEXT,
      local_nfo TEXT,
      date_added INTEGER DEFAULT (strftime('%s','now')),
      date_modified INTEGER DEFAULT (strftime('%s','now')),
      is_missing INTEGER DEFAULT 0,
      is_favorite INTEGER DEFAULT 0,
      play_count INTEGER DEFAULT 0,
      last_played_at INTEGER,
      FOREIGN KEY (volume_serial) REFERENCES drives(volume_serial) ON DELETE CASCADE,
      UNIQUE(volume_serial, folder_rel_path)
    );

    CREATE TABLE IF NOT EXISTS genres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS movie_genres (
      movie_id INTEGER NOT NULL,
      genre_id INTEGER NOT NULL,
      PRIMARY KEY (movie_id, genre_id),
      FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
      FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS directors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS movie_directors (
      movie_id INTEGER NOT NULL,
      director_id INTEGER NOT NULL,
      PRIMARY KEY (movie_id, director_id),
      FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
      FOREIGN KEY (director_id) REFERENCES directors(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS actors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      thumb TEXT
    );

    CREATE TABLE IF NOT EXISTS movie_actors (
      movie_id INTEGER NOT NULL,
      actor_id INTEGER NOT NULL,
      role TEXT,
      sort_order INTEGER DEFAULT 0,
      PRIMARY KEY (movie_id, actor_id),
      FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
      FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS movie_sets (
      movie_id INTEGER NOT NULL,
      set_id INTEGER NOT NULL,
      PRIMARY KEY (movie_id, set_id),
      FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
      FOREIGN KEY (set_id) REFERENCES sets(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_movies_title ON movies(sort_title);
    CREATE INDEX IF NOT EXISTS idx_movies_year ON movies(year);
    CREATE INDEX IF NOT EXISTS idx_movies_rating ON movies(rating);
    CREATE INDEX IF NOT EXISTS idx_movies_date_added ON movies(date_added);
    CREATE INDEX IF NOT EXISTS idx_movies_drive ON movies(volume_serial);
    CREATE INDEX IF NOT EXISTS idx_movies_missing ON movies(is_missing);

    -- Multiple scan roots per drive (e.g. F:\Bollywood, F:\Hollywood on same HDD)
    CREATE TABLE IF NOT EXISTS drive_roots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      volume_serial TEXT NOT NULL,
      root_path TEXT NOT NULL,
      FOREIGN KEY (volume_serial) REFERENCES drives(volume_serial) ON DELETE CASCADE,
      UNIQUE(volume_serial, root_path)
    );

    -- FTS5 for fast full-text search across movies
    CREATE VIRTUAL TABLE IF NOT EXISTS movies_fts USING fts5(
      title, original_title, plot, tagline,
      content='movies', content_rowid='id'
    );

    CREATE TRIGGER IF NOT EXISTS movies_ai AFTER INSERT ON movies BEGIN
      INSERT INTO movies_fts(rowid, title, original_title, plot, tagline)
      VALUES (new.id, new.title, new.original_title, new.plot, new.tagline);
    END;
    CREATE TRIGGER IF NOT EXISTS movies_ad AFTER DELETE ON movies BEGIN
      INSERT INTO movies_fts(movies_fts, rowid, title, original_title, plot, tagline)
      VALUES('delete', old.id, old.title, old.original_title, old.plot, old.tagline);
    END;
    CREATE TRIGGER IF NOT EXISTS movies_au AFTER UPDATE ON movies BEGIN
      INSERT INTO movies_fts(movies_fts, rowid, title, original_title, plot, tagline)
      VALUES('delete', old.id, old.title, old.original_title, old.plot, old.tagline);
      INSERT INTO movies_fts(rowid, title, original_title, plot, tagline)
      VALUES (new.id, new.title, new.original_title, new.plot, new.tagline);
    END;
  `)

  // Migrate existing single-root drives into drive_roots
  db.exec(`
    INSERT OR IGNORE INTO drive_roots (volume_serial, root_path)
    SELECT volume_serial, movie_root_relative FROM drives
    WHERE movie_root_relative IS NOT NULL AND movie_root_relative != '';
  `)

  // ── Migrations (safe to run every startup) ──────────────────────────

  // v1.1 — watched tracking
  const cols = (db.prepare(`PRAGMA table_info(movies)`).all() as any[]).map(c => c.name)
  if (!cols.includes('is_watched')) {
    db.exec(`ALTER TABLE movies ADD COLUMN is_watched INTEGER DEFAULT 0`)
  }

  // v1.1 — user preferences (key/value store)
  db.exec(`
    CREATE TABLE IF NOT EXISTS preferences (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  return db
}
