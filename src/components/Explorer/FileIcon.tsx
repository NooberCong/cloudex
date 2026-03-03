import React from 'react'
import {
  Folder, File, FileText, FileImage, FileVideo, FileAudio,
  FileCode, FileArchive, FileJson, FileType
} from 'lucide-react'
import { getFileExtension } from '../../lib/utils'

interface FileIconProps {
  name: string
  isFolder?: boolean
  className?: string
}

export function FileIcon({ name, isFolder, className = 'w-4 h-4' }: FileIconProps) {
  if (isFolder) {
    return <Folder className={`${className} text-[#60a5fa] fill-[#bfdbfe] dark:fill-[#1e3a5f]`} />
  }

  const ext = getFileExtension(name)

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) {
    return <FileImage className={`${className} text-[#a78bfa]`} />
  }
  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv'].includes(ext)) {
    return <FileVideo className={`${className} text-[#f472b6]`} />
  }
  if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext)) {
    return <FileAudio className={`${className} text-[#34d399]`} />
  }
  if (['zip', 'tar', 'gz', 'bz2', 'rar', '7z', 'zst'].includes(ext)) {
    return <FileArchive className={`${className} text-[#fb923c]`} />
  }
  if (['json', 'jsonl', 'ndjson'].includes(ext)) {
    return <FileJson className={`${className} text-[#facc15]`} />
  }
  if (['pdf'].includes(ext)) {
    return <FileType className={`${className} text-[#f87171]`} />
  }
  if (
    ['js', 'ts', 'tsx', 'jsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h',
     'cs', 'php', 'swift', 'kt', 'sql', 'sh', 'bash', 'zsh', 'fish'].includes(ext)
  ) {
    return <FileCode className={`${className} text-[#67e8f9]`} />
  }
  if (['txt', 'md', 'rst', 'log', 'csv', 'yaml', 'yml', 'toml', 'ini', 'conf', 'env'].includes(ext)) {
    return <FileText className={`${className} text-[var(--text-secondary)]`} />
  }

  return <File className={`${className} text-[var(--text-muted)]`} />
}
