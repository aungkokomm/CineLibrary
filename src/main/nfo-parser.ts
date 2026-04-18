import fs from 'node:fs'
import { XMLParser } from 'fast-xml-parser'

export interface ParsedMovie {
  title: string
  originalTitle?: string
  sortTitle?: string
  year?: number
  rating?: number
  votes?: number
  runtime?: number
  plot?: string
  outline?: string
  tagline?: string
  mpaa?: string
  imdbId?: string
  tmdbId?: string
  premiered?: string
  studio?: string
  country?: string
  trailer?: string
  genres: string[]
  directors: string[]
  actors: Array<{ name: string; role?: string; order?: number; thumb?: string }>
  sets: string[]
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  trimValues: true,
  parseTagValue: true,
  isArray: (name) => ['genre', 'director', 'actor', 'country', 'studio', 'tag', 'set'].includes(name)
})

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return []
  return Array.isArray(v) ? v : [v]
}

function asString(v: any): string | undefined {
  if (v === undefined || v === null) return undefined
  if (typeof v === 'object' && v['#text'] !== undefined) return String(v['#text']).trim()
  const s = String(v).trim()
  return s || undefined
}

function asNumber(v: any): number | undefined {
  const s = asString(v)
  if (!s) return undefined
  const n = parseFloat(s)
  return isNaN(n) ? undefined : n
}

function asInt(v: any): number | undefined {
  const n = asNumber(v)
  return n === undefined ? undefined : Math.round(n)
}

/**
 * Extract rating from NFO. Supports both old Kodi format (<rating>X.X</rating>)
 * and new format (<ratings><rating name="..."><value>X.X</value>...</rating></ratings>)
 */
function extractRating(movie: any): { rating?: number; votes?: number } {
  // New Kodi format: <ratings><rating ...><value>X</value><votes>Y</votes></rating></ratings>
  if (movie.ratings?.rating) {
    const ratings = toArray(movie.ratings.rating)
    // Prefer default, then imdb, then first
    const preferred = ratings.find((r: any) => r['@_default'] === 'true')
      || ratings.find((r: any) => r['@_name'] === 'imdb')
      || ratings[0]
    if (preferred) {
      return {
        rating: asNumber(preferred.value),
        votes: asInt(preferred.votes)
      }
    }
  }
  // Old format
  return {
    rating: asNumber(movie.rating),
    votes: asInt(movie.votes)
  }
}

function extractId(movie: any, type: 'imdb' | 'tmdb'): string | undefined {
  // New format: <uniqueid type="imdb" default="true">tt123</uniqueid>
  if (movie.uniqueid) {
    const ids = toArray(movie.uniqueid)
    const match = ids.find((u: any) => u['@_type']?.toLowerCase() === type)
    if (match) return asString(match['#text'] || match)
  }
  // Old format: <id>tt123</id> (typically IMDB) or <imdbid> / <tmdbid>
  if (type === 'imdb') {
    const id = asString(movie.imdbid) || asString(movie.id)
    if (id?.startsWith('tt')) return id
  }
  if (type === 'tmdb') {
    return asString(movie.tmdbid)
  }
  return undefined
}

export function parseNfoFile(filePath: string): ParsedMovie | null {
  let xml: string
  try {
    xml = fs.readFileSync(filePath, 'utf8')
  } catch {
    return null
  }

  // Some .nfo files have BOM or trailing garbage; clean up
  xml = xml.replace(/^\uFEFF/, '').trim()
  // Some NFOs have a URL appended after </movie>
  const movieEnd = xml.lastIndexOf('</movie>')
  if (movieEnd !== -1) xml = xml.substring(0, movieEnd + '</movie>'.length)

  let parsed: any
  try {
    parsed = parser.parse(xml)
  } catch {
    return null
  }

  const movie = parsed?.movie
  if (!movie) return null

  const title = asString(movie.title)
  if (!title) return null

  const { rating, votes } = extractRating(movie)

  // Runtime in minutes - sometimes in <runtime> as "120" or "2h 0mn"
  let runtime = asInt(movie.runtime)
  if (!runtime && movie.runtime) {
    const rtStr = asString(movie.runtime) || ''
    const hours = rtStr.match(/(\d+)\s*h/)
    const mins = rtStr.match(/(\d+)\s*m/)
    if (hours || mins) {
      runtime = (hours ? parseInt(hours[1]) * 60 : 0) + (mins ? parseInt(mins[1]) : 0)
    }
  }

  // Actors with role and order
  const actors: ParsedMovie['actors'] = toArray(movie.actor).map((a: any) => ({
    name: asString(a.name) || '',
    role: asString(a.role),
    order: asInt(a.order),
    thumb: asString(a.thumb)
  })).filter(a => a.name)

  // Genres
  const genres = toArray(movie.genre).map(g => asString(g) || '').filter(Boolean)

  // Directors
  const directors = toArray(movie.director).map(d => asString(d) || '').filter(Boolean)

  // Sets / collections
  let sets: string[] = []
  if (movie.set) {
    if (typeof movie.set === 'string') {
      sets = [movie.set]
    } else if (Array.isArray(movie.set)) {
      sets = movie.set.map((s: any) => asString(s.name) || asString(s) || '').filter(Boolean)
    } else {
      const name = asString(movie.set.name) || asString(movie.set)
      if (name) sets = [name]
    }
  }

  return {
    title,
    originalTitle: asString(movie.originaltitle),
    sortTitle: asString(movie.sorttitle) || title,
    year: asInt(movie.year),
    rating,
    votes,
    runtime,
    plot: asString(movie.plot),
    outline: asString(movie.outline),
    tagline: asString(movie.tagline),
    mpaa: asString(movie.mpaa),
    imdbId: extractId(movie, 'imdb'),
    tmdbId: extractId(movie, 'tmdb'),
    premiered: asString(movie.premiered) || asString(movie.releasedate),
    studio: toArray(movie.studio).map(s => asString(s) || '').filter(Boolean).join(', ') || undefined,
    country: toArray(movie.country).map(c => asString(c) || '').filter(Boolean).join(', ') || undefined,
    trailer: asString(movie.trailer),
    genres,
    directors,
    actors,
    sets
  }
}
