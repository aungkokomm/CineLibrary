import { create } from 'zustand'
import type { Drive, MovieListItem, Facets, Stats } from '../api'

export type SortKey = 'title' | 'year' | 'rating' | 'runtime' | 'date_added'
export type SortDir = 'asc' | 'desc'
export type ViewMode = 'grid' | 'list'
export type Page = 'library' | 'drives' | 'favorites'

interface State {
  page: Page
  drives: Drive[]
  movies: MovieListItem[]
  stats: Stats | null
  facets: Facets | null
  loading: boolean
  scanProgress: Record<string, any>

  // Filters
  search: string
  sortKey: SortKey
  sortDir: SortDir
  genre: string | null
  director: string | null
  actor: string | null
  year: number | null
  driveSerial: string | null
  viewMode: ViewMode
  showMissing: boolean

  // Modal
  openMovieId: number | null

  // Actions
  setPage: (p: Page) => void
  setSearch: (s: string) => void
  setSort: (k: SortKey, d?: SortDir) => void
  setFilter: (f: Partial<Pick<State, 'genre'|'director'|'actor'|'year'|'driveSerial'|'showMissing'>>) => void
  setViewMode: (m: ViewMode) => void
  clearFilters: () => void
  setOpenMovieId: (id: number | null) => void

  // Data
  loadDrives: () => Promise<void>
  loadMovies: () => Promise<void>
  loadStats: () => Promise<void>
  loadFacets: () => Promise<void>
  refreshAll: () => Promise<void>
  setScanProgress: (serial: string, p: any) => void
}

export const useStore = create<State>((set, get) => ({
  page: 'library',
  drives: [],
  movies: [],
  stats: null,
  facets: null,
  loading: false,
  scanProgress: {},

  search: '',
  sortKey: 'title',
  sortDir: 'asc',
  genre: null,
  director: null,
  actor: null,
  year: null,
  driveSerial: null,
  viewMode: 'grid',
  showMissing: true,

  openMovieId: null,

  setPage: (page) => {
    set({ page })
    // Refresh relevant data per page
    if (page === 'favorites' || page === 'library') get().loadMovies()
  },
  setSearch: (search) => {
    set({ search })
    clearTimeout((useStore as any)._searchTimer)
    ;(useStore as any)._searchTimer = setTimeout(() => get().loadMovies(), 250)
  },
  setSort: (sortKey, sortDir) => {
    set({ sortKey, sortDir: sortDir ?? (get().sortKey === sortKey && get().sortDir === 'asc' ? 'desc' : 'asc') })
    get().loadMovies()
  },
  setFilter: (f) => { set(f); get().loadMovies(); get().loadFacets() },
  setViewMode: (viewMode) => set({ viewMode }),
  clearFilters: () => {
    set({ search: '', genre: null, director: null, actor: null, year: null, driveSerial: null, sortKey: 'title', sortDir: 'asc' })
    get().loadMovies(); get().loadFacets()
  },
  setOpenMovieId: (openMovieId) => set({ openMovieId }),

  loadDrives: async () => {
    const drives = await window.api.drives.list()
    set({ drives })
  },
  loadMovies: async () => {
    set({ loading: true })
    const state = get()
    const movies = await window.api.movies.list({
      search: state.search,
      sort: state.sortKey,
      sortDir: state.sortDir,
      genre: state.genre || undefined,
      director: state.director || undefined,
      actor: state.actor || undefined,
      year: state.year || undefined,
      driveSerial: state.driveSerial || undefined,
      showMissing: state.showMissing,
      favoritesOnly: state.page === 'favorites'
    })
    set({ movies, loading: false })
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
  refreshAll: async () => {
    await Promise.all([
      get().loadDrives(),
      get().loadMovies(),
      get().loadStats(),
      get().loadFacets()
    ])
  },
  setScanProgress: (serial, p) => {
    set(state => ({ scanProgress: { ...state.scanProgress, [serial]: p } }))
  }
}))
