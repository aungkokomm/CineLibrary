export interface DriveRoot {
  id: number
  root_path: string
}

export interface Drive {
  volume_serial: string
  label: string
  last_seen_letter?: string
  last_connected_at?: number
  movie_root_relative: string
  roots: DriveRoot[]
  movie_count: number
  missing_count: number
  is_connected: boolean
  current_letter: string | null
}

export interface Collection {
  id: number
  name: string
  movie_count: number
}

export interface MovieListItem {
  id: number
  title: string
  year?: number
  rating?: number
  runtime?: number
  tagline?: string
  local_poster?: string
  is_missing: number
  is_favorite: number
  is_watched: number
  volume_serial: string
  drive_label?: string
  genres_csv?: string
}

export interface MovieDetail extends MovieListItem {
  original_title?: string
  plot?: string
  outline?: string
  mpaa?: string
  imdb_id?: string
  tmdb_id?: string
  premiered?: string
  studio?: string
  country?: string
  trailer?: string
  local_fanart?: string
  local_nfo?: string
  folder_rel_path?: string
  video_file_rel_path?: string
  date_added?: number
  genres: string[]
  directors: string[]
  actors: Array<{ name: string; thumb?: string; role?: string; sort_order: number }>
  sets: string[]
  current_letter: string | null
  playable: boolean
}

export interface Stats {
  totalMovies: number
  totalMissing: number
  totalRuntime: number
  avgRating: number
  totalGenres: number
  totalDrives: number
}

export interface Facets {
  genres: Array<{ name: string; count: number }>
  directors: Array<{ name: string; count: number }>
  actors: Array<{ name: string; count: number }>
  years: number[]
}

declare global {
  interface Window {
    api: {
      drives: {
        list: () => Promise<Drive[]>
        add: () => Promise<any>
        rename: (serial: string, label: string) => Promise<any>
        remove: (serial: string) => Promise<any>
        scan: (serial: string) => Promise<any>
        addRoot: (serial: string) => Promise<any>
        removeRoot: (serial: string, rootId: number) => Promise<any>
        onScanProgress: (cb: (p: any) => void) => () => void
      }
      movies: {
        list: (opts: any) => Promise<MovieListItem[]>
        detail: (id: number) => Promise<MovieDetail | null>
        toggleFavorite: (id: number) => Promise<{ is_favorite: number }>
        toggleWatched:  (id: number) => Promise<{ is_watched: number }>
        play: (id: number) => Promise<any>
        openFolder: (id: number) => Promise<any>
        removeMissing: (driveSerial?: string) => Promise<{ deleted: number }>
      }
      collections: { list: () => Promise<Collection[]> }
      facets: { all: (filters?: Partial<{ genre: string; director: string; actor: string; year: number; driveSerial: string; showMissing: boolean }>) => Promise<Facets> }
      stats: { overview: () => Promise<Stats> }
      prefs: { get: () => Promise<Record<string, any>>; set: (key: string, value: any) => Promise<any> }
      export: { csv: (opts?: any) => Promise<any>; html: (opts?: any) => Promise<any> }
      cache: { getImage: (relPath: string) => Promise<string | null> }
    }
    app: {
      about: () => void
    }
    win: {
      minimize: () => void
      maximize: () => void
      close:    () => void
    }
  }
}

export {}
