import { contextBridge, ipcRenderer } from 'electron'

const api = {
  drives: {
    list:    () => ipcRenderer.invoke('drives:list'),
    add:     () => ipcRenderer.invoke('drives:add'),
    rename:  (serial: string, label: string) => ipcRenderer.invoke('drives:rename', serial, label),
    remove:  (serial: string) => ipcRenderer.invoke('drives:remove', serial),
    scan:      (serial: string) => ipcRenderer.invoke('drives:scan', serial),
    addRoot:   (serial: string) => ipcRenderer.invoke('drives:addRoot', serial),
    removeRoot:(serial: string, rootId: number) => ipcRenderer.invoke('drives:removeRoot', serial, rootId),
    onScanProgress: (cb: (p: any) => void) => {
      const listener = (_e: any, data: any) => cb(data)
      ipcRenderer.on('scan:progress', listener)
      return () => ipcRenderer.removeListener('scan:progress', listener)
    }
  },
  movies: {
    list:     (opts: any) => ipcRenderer.invoke('movies:list', opts),
    detail:   (id: number) => ipcRenderer.invoke('movies:detail', id),
    toggleFavorite: (id: number) => ipcRenderer.invoke('movies:toggleFavorite', id),
    play:     (id: number) => ipcRenderer.invoke('movies:play', id),
    openFolder: (id: number) => ipcRenderer.invoke('movies:openFolder', id),
    removeMissing: (driveSerial?: string) => ipcRenderer.invoke('movies:removeMissing', driveSerial)
  },
  facets: {
    all: (filters?: any) => ipcRenderer.invoke('facets:all', filters)
  },
  stats: {
    overview: () => ipcRenderer.invoke('stats:overview')
  },
  cache: {
    getImage: (relPath: string) => ipcRenderer.invoke('cache:getImage', relPath)
  }
}

const appControls = {
  about: () => ipcRenderer.send('app:about'),
}

const winControls = {
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close:    () => ipcRenderer.send('win:close'),
}

contextBridge.exposeInMainWorld('api', api)
contextBridge.exposeInMainWorld('app', appControls)
contextBridge.exposeInMainWorld('win', winControls)

export type Api = typeof api
