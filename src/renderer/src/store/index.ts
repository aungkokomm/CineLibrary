import { create } from 'zustand'
import type { Drive, MovieListItem, Facets, Stats, Collection } from '../api'

export type SortKey = 'title' | 'year' | 'rating' | 'runtime' | 'date_added'
export type SortDir = 'asc' | 'desc'
export type ViewMode = 'grid' | 'list'
export type Page = 'library' | 'drives' | 'favorites'
export type WatchedFilter = 'all' | 'watched' | 'unwatched'

export interface Toast {
  id: string
  message: string
  driveSerial?: string
  driveLabel?: string
}

const PAGE_SIZE = 60

interface State {
  page: Page
  drives: Drive[]
  movies: MovieListItem[]
  collections: Collection[]
  stats: Stats | null
  facets: Facets | null
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  scanProgress: Record<string, any>
  toasts: Toast[]
  prefsLoaded: boolean

  search: string
  sortKey: SortKey
  sortDir: SortDir
  genre: string | null
  director: string | null
  actor: string | null
  year: number | null
  driveSerial: string | null
  collectionId: number | null
  viewMode: ViewMode
  showMissing: boolean
  watchedFilter: WatchedFilter

  openMovieId: number | null

  setPage: (p: Page) => void
  setSearch: (s: string) => void
  setSort: (k: SortKey, d?: SortDir) => void
  setFilter: (f: Partial<Pick<State, 'genre'|'director'|'actor'|'year'|'driveSerial'|'collectionId'|'showMissing'|'watchedFilter'>>) => void
  setViewMode: (m: ViewMode) => void
  clearFilters: () => void
  setOpenMovieId: (id: number | null) => void
  addToast: (msg: string, driveSerial?: string, driveLabel?: string) => void
  removeToast: (id: string) => void

  loadDrives: () => Promise<void>
  loadMovies: () => Promise<void>
  loadMoreMovies: () => Promise<void>
  loadStats: () => Promise<void>
  loadFacets: () => Promise<void>
  loadCollections: () => Promise<void>
  refreshAll: () => Promise<void>
  loadPrefs: () => Promise<void>
  setScanProgress: (serial: string, p: any) => void
}

function buildListOpts(state: State, offset = 0) {
  return {
    search:        state.search,
    sort:          state.sortKey,
    sortDir:       state.sortDir,
    genre:         state.genre        || undefined,
    director:      state.director     || undefined,
    actor:         state.actor        || undefined,
    year:          state.year         || undefined,
    driveSerial:   state.driveSerial  || undefined,
    collectionId:  state.collectionId || undefined,
    showMissing:   state.showMissing,
    favoritesOnly: state.page === 'favorites',
    watchedFilter: state.watchedFilter,
    limit:  PAGE_SIZE,
    offset,
  }
}

export const useStore = create<State>((set, get) => ({
  page: 'library',
  drives: [],
  movies: [],
  collections: [],
  stats: null,
  facets: null,
  loading: false,
  loadingMore: false,
  hasMore: false,
  scanProgress: {},
  toasts: [],
  prefsLoaded: false,

  search: '',
  sortKey: 'title',
  sortDir: 'asc',
  genre: null,
  director: null,
  actor: null,
  year: null,
  driveSerial: null,
  collectionId: null,
  viewMode: 'grid',
  showMissing: true,
  watchedFilter: 'all',

  openMovieId: null,

  setPage: (page) => {
    set({ page })
    if (page === 'favorites' || page === 'library') get().loadMovies()
  },
  setSearch: (search) => {
    set({ search })
    clearTimeout((useStore as any)._searchTimer)
    ;(useStore as any)._searchTimer = setTimeout(() => get().loadMovies(), 250)
  },
  setSort: (sortKey, sortDir) => {
    const newDir = sortDir ?? (get().sortKey === sortKey && get().sortDir === 'asc' ? 'desc' : 'asc')
    set({ sortKey, sortDir: newDir })
    window.api.prefs.set('sortKey', sortKey)
    window.api.prefs.set('sortDir', newDir)
    get().loadMovies()
  },
  setFilter: (f) => { set(f); get().loadMovies(); get().loadFacets() },
  setViewMode: (viewMode) => {
    set({ viewMode })
    window.api.prefs.set('viewMode', viewMode)
  },
  clearFilters: () => {
    set({ search: '', genre: null, director: null, actor: null, year: null,
          driveSerial: null, collectionId: null, sortKey: 'title', sortDir: 'asc',
          watchedFilter: 'all' })
    get().loadMovies(); get().loadFacets()
  },
  setOpenMovieId: (openMovieId) => set({ openMovieId }),

  addToast: (message, driveSerial, driveLabel) => {
    const id = Math.random().toString(36).slice(2)
    set(s => ({ toasts: [...s.toasts, { id, message, driveSerial, driveLabel }] }))
    setTimeout(() => get().removeToast(id), 8000)
  },
  removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),

  loadDrives: async () => {
    const prev = get().drives
    const drives = await window.api.drives.list()
    for (const d of drives) {
      const was = prev.find(p => p.volume_serial === d.volume_serial)
      if (was && !was.is_connected && d.is_connected) {
        get().addToast(`"${d.label}" reconnected — rescan to update?`, d.volume_serial, d.label)
      }
    }
    set({ drives })
  },

  loadMovies: async () => {
    set({ loading: true })
    const batch = await window.api.movies.list(buildListOpts(get(), 0))
    set({ movies: batch, loading: false, hasMore: batch.length === PAGE_SIZE, loadingMore: false })
  },

  loadMoreMovies: async () => {
    const { loading, loadingMore, hasMore, movies } = get()
    if (loading || loadingMore || !hasMore) return
    set({ loadingMore: true })
    const batch = await window.api.movies.list(buildListOpts(get(), movies.length))
    set(s => ({
      movies: [...s.movies, ...batch],
      loadingMore: false,
      hasMore: batch.length === PAGE_SIZE,
    }))
  },

  loadStats: async () => {
    const stats = await window.api.stats.overview()
    set({ stats })
  },

  loadFacets: async () => {
    const s = get()
    const facets = await window.api.facets.all({
      genre:       s.genre       || undefined,
      director:    s.director    || undefined,
      actor:       s.actor       || undefined,
      year:        s.year        || undefined,
      driveSerial: s.driveSerial || undefined,
      showMissing: s.showMissing
    })
    set({ facets })
  },

  loadCollections: async () => {
    const collections = await window.api.collections.list()
    set({ collections })
  },

  refreshAll: async () => {
    await Promise.all([
      get().loadDrives(),
      get().loadMovies(),
      get().loadStats(),
      get().loadFacets(),
      get().loadCollections(),
    ])
  },

  loadPrefs: async () => {
    const prefs = await window.api.prefs.get()
    const patch: Partial<State> = { prefsLoaded: true }
    if (prefs.viewMode) patch.viewMode = prefs.viewMode
    if (prefs.sortKey)  patch.sortKey  = prefs.sortKey
    if (prefs.sortDir)  patch.sortDir  = prefs.sortDir
    set(patch)
  },

  setScanProgress: (serial, p) => {
    set(state => ({ scanProgress: { ...state.scanProgress, [serial]: p } }))
  }
}))
