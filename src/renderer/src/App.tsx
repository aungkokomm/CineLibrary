import { useEffect } from 'react'
import { useStore } from './store'
import Sidebar from './components/Sidebar'
import TitleBar from './components/TitleBar'
import Topbar from './components/Topbar'
import LibraryPage from './pages/LibraryPage'
import DrivesPage from './pages/DrivesPage'
import WelcomePage from './pages/WelcomePage'
import MovieModal from './components/MovieModal'
import './styles/App.css'

export default function App() {
  const { page, drives, refreshAll, loadDrives, setScanProgress } = useStore()

  useEffect(() => {
    refreshAll()
    // Listen for scan progress events
    const unsub = window.api.drives.onScanProgress((p) => {
      setScanProgress(p.volumeSerial, p)
      if (p.phase === 'done') {
        refreshAll()
      }
    })
    return () => unsub()
  }, [])

  // Periodic drive detection refresh (so connected/disconnected status stays current)
  useEffect(() => {
    const interval = setInterval(() => { loadDrives() }, 10000)
    return () => clearInterval(interval)
  }, [])

  // Show welcome screen if no drives yet
  if (drives.length === 0) {
    return (
      <div className="app app-frameless">
        <TitleBar />
        <WelcomePage />
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
          {page === 'library' && <LibraryPage />}
          {page === 'favorites' && <LibraryPage />}
          {page === 'drives' && <DrivesPage />}
        </div>
      </div>
      </div>
      <MovieModal />
    </div>
  )
}
