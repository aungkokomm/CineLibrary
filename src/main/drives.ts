import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export interface DetectedDrive {
  letter: string              // e.g. 'E:'
  volumeSerial: string        // permanent hardware ID
  volumeName?: string         // Windows volume label
}

/**
 * Get the volume serial number of a drive given its letter.
 * Uses PowerShell on Windows for reliability.
 */
export function getVolumeSerialForLetter(letter: string): string | null {
  if (process.platform !== 'win32') {
    // Dev fallback on non-Windows: hash the path
    return `dev-${Buffer.from(letter).toString('hex').slice(0, 8)}`
  }
  try {
    const driveLetter = letter.replace(/[:\\]/g, '')
    // Get VolumeSerialNumber via WMI (stable across replugs)
    const cmd = `powershell -NoProfile -Command "(Get-CimInstance -ClassName Win32_LogicalDisk -Filter \\"DeviceID='${driveLetter}:'\\").VolumeSerialNumber"`
    const result = execSync(cmd, { encoding: 'utf8', windowsHide: true }).trim()
    return result || null
  } catch {
    return null
  }
}

/**
 * Get volume label (Windows label user sets on the drive) for fallback naming.
 */
export function getVolumeLabelForLetter(letter: string): string | null {
  if (process.platform !== 'win32') return null
  try {
    const driveLetter = letter.replace(/[:\\]/g, '')
    const cmd = `powershell -NoProfile -Command "(Get-CimInstance -ClassName Win32_LogicalDisk -Filter \\"DeviceID='${driveLetter}:'\\").VolumeName"`
    const result = execSync(cmd, { encoding: 'utf8', windowsHide: true }).trim()
    return result || null
  } catch {
    return null
  }
}

/**
 * Given a folder path (e.g. E:\Movies), detect which drive letter it's on
 * and return the volume serial and metadata.
 */
export function detectDriveForPath(folderPath: string): DetectedDrive | null {
  const root = path.parse(folderPath).root  // 'E:\\' on Windows
  if (!root) return null
  const letter = root.slice(0, 2)  // 'E:'
  const volumeSerial = getVolumeSerialForLetter(letter)
  if (!volumeSerial) return null
  const volumeName = getVolumeLabelForLetter(letter) || undefined
  return { letter, volumeSerial, volumeName }
}

/**
 * Check which registered drives are currently connected by walking all
 * drive letters and matching volume serials.
 */
export function scanAllConnectedDrives(): DetectedDrive[] {
  const drives: DetectedDrive[] = []
  if (process.platform !== 'win32') {
    // Dev: return nothing by default
    return drives
  }
  try {
    // Get all drives and their serials in a single PS call
    const cmd = `powershell -NoProfile -Command "Get-CimInstance -ClassName Win32_LogicalDisk | Select-Object DeviceID,VolumeSerialNumber,VolumeName | ConvertTo-Json -Compress"`
    const result = execSync(cmd, { encoding: 'utf8', windowsHide: true }).trim()
    if (!result) return drives
    const parsed = JSON.parse(result)
    const list = Array.isArray(parsed) ? parsed : [parsed]
    for (const d of list) {
      if (d.DeviceID && d.VolumeSerialNumber) {
        drives.push({
          letter: d.DeviceID,
          volumeSerial: String(d.VolumeSerialNumber),
          volumeName: d.VolumeName || undefined
        })
      }
    }
  } catch (err) {
    console.error('Drive scan failed:', err)
  }
  return drives
}

/**
 * Given a registered drive (by volume_serial), find its current drive letter
 * if it's plugged in. Returns null if offline.
 */
export function findCurrentLetterForSerial(volumeSerial: string): string | null {
  const connected = scanAllConnectedDrives()
  const match = connected.find(d => d.volumeSerial === volumeSerial)
  return match ? match.letter : null
}

/**
 * Resolve an absolute path for a movie on a specific drive.
 * Returns null if drive isn't currently plugged in.
 */
export function resolveMoviePath(volumeSerial: string, relPath: string): string | null {
  const letter = findCurrentLetterForSerial(volumeSerial)
  if (!letter) return null
  const fullPath = path.join(letter + '\\', relPath)
  return fs.existsSync(fullPath) ? fullPath : null
}
