# CineLibrary

**A portable Windows app to browse and manage your MediaElch-scraped movie collection across multiple external drives.**

> ⚠️ **Prerequisite:** Your movies must already be organised in folders and scraped with [MediaElch](https://mediaelch.github.io/mediaelch-doc/) before using CineLibrary. MediaElch writes the `.nfo` metadata files and poster/fanart images that CineLibrary reads.

---

## Download

👉 **[Latest Release — CineLibrary-1.0.0-portable.exe](https://github.com/aungkokomm/CineLibrary/releases/latest)**

No install needed. Just double-click and run.

---

## What it does

| Feature | Detail |
|---|---|
| **Portable** | Runs from anywhere — USB stick, SSD, folder. All data stays next to the `.exe` |
| **Reads MediaElch NFOs** | Imports plot, rating, actors, directors, genres, studios, posters, fanart |
| **Local cache** | Copies artwork locally so you can browse offline even without the drive |
| **Drive identification** | Uses hardware volume serial — drive letters (D:, E:, F:) can change freely |
| **Multiple drives** | Add as many external HDDs as you like, each with multiple movie folders |
| **Missing-safe** | Movies removed from a drive stay in your catalog marked `MISSING` — nothing is ever auto-deleted |
| **Full-text search** | Search across title, plot, actor, director simultaneously |
| **Filters** | Genre · Director · Actor · Year · Drive |
| **Sort** | Title · Year · Rating · Runtime · Date Added |
| **Play** | Opens your movie in the default media player when the drive is connected |
| **Grid & List views** | Switch between poster grid and metadata list |
| **Favorites** | Star any movie, browse them separately |

---

## How to use

### First time
1. Scrape your movies with [MediaElch](https://mediaelch.github.io/mediaelch-doc/) — it writes `.nfo` + poster/fanart files into each movie folder
2. Run `CineLibrary-portable.exe`
3. Click **Add Your First Drive** → select the folder that contains your movie folders
4. CineLibrary scans every subfolder for `.nfo` files and imports everything

### Adding more folders
Go to **Drives** → click **＋ Add Folder** on an existing drive to add more movie root folders (useful if you have `Movies/`, `TV-as-Movies/`, etc. on the same drive).

### After adding new movies
Scrape the new movies in MediaElch first, then go to **Drives** → **Update Database** to re-import.

### When the drive is unplugged
Everything is still browsable. Posters and metadata are cached locally. Only **Play** is disabled until the drive is reconnected.

---

## Folder structure expected

```
YourDrive/
└── Movies/                   ← add this folder to CineLibrary
    ├── Inception (2010)/
    │   ├── Inception.mkv
    │   ├── movie.nfo         ← written by MediaElch
    │   ├── poster.jpg        ← written by MediaElch
    │   └── fanart.jpg        ← written by MediaElch
    ├── The Dark Knight (2008)/
    │   ├── ...
```

---

## Stack

- **Electron 33** — desktop shell, portable build
- **React 18 + TypeScript + Vite** — renderer
- **better-sqlite3 + FTS5** — fast SQLite full-text search
- **fast-xml-parser** — MediaElch NFO parsing
- **Zustand** — state management

---

## Build from source

Requires Node.js 18+ and Windows 64-bit.

```bash
npm install
npm run dev        # development
npm run build      # produces release/CineLibrary-1.0.0-portable.exe
```

---

## License

MIT
