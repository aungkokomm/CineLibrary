import { useEffect, useState, memo } from 'react'

interface Props {
  relPath?: string | null
  alt?: string
  className?: string
  fallback?: React.ReactNode
}

const imageCache = new Map<string, string>()
const imageLoading = new Map<string, Promise<string | null>>()

async function loadImage(relPath: string): Promise<string | null> {
  if (imageCache.has(relPath)) return imageCache.get(relPath)!
  if (imageLoading.has(relPath)) return imageLoading.get(relPath)!
  const p = window.api.cache.getImage(relPath).then(data => {
    imageLoading.delete(relPath)
    if (data) imageCache.set(relPath, data)
    return data
  })
  imageLoading.set(relPath, p)
  return p
}

function CachedImage({ relPath, alt, className, fallback }: Props) {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!relPath) { setSrc(null); return }
    loadImage(relPath).then(data => {
      if (cancelled) return
      if (data) setSrc(data)
      else setError(true)
    }).catch(() => !cancelled && setError(true))
    return () => { cancelled = true }
  }, [relPath])

  if (!relPath || error) {
    return <>{fallback}</>
  }
  if (!src) {
    return <div className={className} style={{ background: 'var(--card)' }} />
  }
  return <img src={src} alt={alt || ''} className={className} loading="lazy" />
}

export default memo(CachedImage)
