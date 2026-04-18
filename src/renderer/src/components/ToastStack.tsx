import { useStore } from '../store'

export default function ToastStack() {
  const { toasts, removeToast, setPage, loadMovies } = useStore()
  if (toasts.length === 0) return null

  return (
    <div className="toast-stack">
      {toasts.map(t => (
        <div key={t.id} className="toast slide-up">
          <div className="toast-msg">{t.message}</div>
          <div className="toast-actions">
            {t.driveSerial && (
              <button
                className="toast-btn toast-btn-primary"
                onClick={() => {
                  window.api.drives.scan(t.driveSerial!)
                    .then(() => loadMovies())
                  removeToast(t.id)
                  setPage('drives')
                }}
              >
                Rescan
              </button>
            )}
            <button className="toast-btn" onClick={() => removeToast(t.id)}>✕</button>
          </div>
        </div>
      ))}
    </div>
  )
}
