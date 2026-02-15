declare module 'https://jslib.k6.io/url/1.0.0/index.js' {
  export class URLSearchParams {
    constructor(init?: string | Record<string, string> | [string, string][])
    append(name: string, value: string): void
    delete(name: string): void
    get(name: string): string | null
    getAll(name: string): string[]
    has(name: string): boolean
    set(name: string, value: string): void
    toString(): string
    entries(): IterableIterator<[string, string]>
    keys(): IterableIterator<string>
    values(): IterableIterator<string>
    forEach(callback: (value: string, key: string, parent: URLSearchParams) => void): void
    [Symbol.iterator](): IterableIterator<[string, string]>
  }
}

declare function open(path: string, encoding?: string): string

