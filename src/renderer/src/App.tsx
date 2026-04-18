import { useEffect } from 'react'
import { useStore } from './store'
import Sidebar from './components/Sidebar'
import TitleBar from './components/TitleBar'
import Topbar from './components/Topbar'
import LibraryPage from './pages/LibraryPage'
import DrivesPage from './pages/DrivesPage'
import WelcomePage from './pages/WelcomePage'
import MovieModal from './components/MovieModal'
import ToastStack from './components/ToastStack'
import './styles/App.css'

export default function App() {
  const { page, drives, refreshAll, loadDrives, loadPrefs, setScanProgress, prefsLoaded } = useStore()

  // Load saved preferences first, then fetch all data
  useEffect(() => {
    loadPrefs().then(() => refreshAll())
    const unsub = window.api.drives.onScanProgress((p) => {
      setScanProgress(p.volumeSerial, p)
      if (p.phase === 'done') refreshAll()
    })
    return () => unsub()
  }, [])

  // Poll drive connectivity every 10s (detects reconnects → toast)
  useEffect(() => {
    const interval = setInterval(() => loadDrives(), 10000)
    return () => clearInterval(interval)
  }, [])

  if (!prefsLoaded) return null   // wait for prefs before rendering to avoid flash

  if (drives.length === 0) {
    return (
      <div className="app app-frameless">
        <TitleBar />
        <WelcomePage />
        <ToastStack />
      </div>
    )
  }

  return (
    <div className="app app-frameless">
      <TitleBar />
      <div className="app-body">
        <Sidebar />
        <div className="main">
          <Topbar />
          <div className="content">
            {page === 'library'   && <LibraryPage />}
            {page === 'favorites' && <LibraryPage />}
            {page === 'drives'    && <DrivesPage />}
          </div>
        </div>
      </div>
      <MovieModal />
      <ToastStack />
    </div>
  )
}
