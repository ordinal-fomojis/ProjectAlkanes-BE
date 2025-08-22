import { extname } from "path"
import { UserError } from "./errors.js"

// Source: https://github.com/ordinals/ord/blob/master/src/inscriptions/media.rs#L69
export const MimeType = {
  'cbor': 'application/cbor',
  'json': 'application/json',
  'bin': 'application/octet-stream',
  'pdf': 'application/pdf',
  'asc': 'application/pgp-signature',
  'binpb': 'application/protobuf',
  'torrent': 'application/x-bittorrent',
  'yaml': 'application/yaml',
  'yml': 'application/yaml',
  'flac': 'audio/flac',
  'mp3': 'audio/mpeg',
  'ogg': 'audio/ogg',
  'opus': 'audio/ogg;codecs=opus',
  'wav': 'audio/wav',
  'otf': 'font/otf',
  'ttf': 'font/ttf',
  'woff': 'font/woff',
  'woff2': 'font/woff2',
  'apng': 'image/apng',
  'avif': 'image/avif',
  'gif': 'image/gif',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'jxl': 'image/jxl',
  'png': 'image/png',
  'svg': 'image/svg+xml',
  'webp': 'image/webp',
  'gltf': 'model/gltf+json',
  'glb': 'model/gltf-binary',
  'stl': 'model/stl',
  'css': 'text/css',
  'html': 'text/html;charset=utf-8',
  'js': 'text/javascript',
  'mjs': 'text/javascript',
  'md': 'text/markdown;charset=utf-8',
  'txt': 'text/plain;charset=utf-8',
  'py': 'text/x-python',
  'mp4': 'video/mp4',
  'webm': 'video/webm'
} as const

export type FileExtension = keyof typeof MimeType
export type MimeType = (typeof MimeType)[FileExtension]

class InvalidFileExtensionError extends UserError {
  constructor(extension: string) {
    super(`Invalid file extension: ${extension}`)
    this.name = 'InvalidFileExtensionError'
  }
}

export function getMimeType(fileName: string) {
  const extension = extname(fileName).replace('.', '')
  const mimeType = MimeType[extension as FileExtension]
  if (mimeType == null) {
    throw new InvalidFileExtensionError(extension)
  }
  return mimeType
}

