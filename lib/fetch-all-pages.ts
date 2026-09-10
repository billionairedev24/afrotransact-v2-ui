import type { Page } from "./api"

/**
 * Walks a server-paginated endpoint and returns every row.
 *
 * Exports that read only the page on screen quietly answer the wrong question:
 * an "Analytics" sheet built from 50 of 4,000 orders looks authoritative and
 * isn't. This pulls the whole set so the file matches what the user believes
 * they downloaded.
 *
 * Deliberately capped. An unbounded loop against a growing table is how an
 * export becomes an outage, so it stops at `maxPages` and reports that it was
 * truncated rather than silently returning a partial set — the caller is
 * expected to surface that, not swallow it.
 */
export interface FetchAllResult<T> {
  rows: T[]
  /** True when the cap stopped us before the end of the data. */
  truncated: boolean
  totalAvailable: number
}

export async function fetchAllPages<T>(
  fetchPage: (page: number, size: number) => Promise<Page<T>>,
  opts: { pageSize?: number; maxPages?: number; onProgress?: (loaded: number, total: number) => void } = {},
): Promise<FetchAllResult<T>> {
  const pageSize = opts.pageSize ?? 200
  const maxPages = opts.maxPages ?? 50 // 10k rows at the default size
  const rows: T[] = []

  const first = await fetchPage(0, pageSize)
  rows.push(...(first.content ?? []))
  const totalAvailable = first.totalElements ?? rows.length
  const totalPages = first.totalPages ?? 1
  opts.onProgress?.(rows.length, totalAvailable)

  const pagesToRead = Math.min(totalPages, maxPages)
  for (let p = 1; p < pagesToRead; p++) {
    const next = await fetchPage(p, pageSize)
    const content = next.content ?? []
    // A short page means we've reached the end; stop rather than spend
    // round-trips on empty responses.
    if (content.length === 0) break
    rows.push(...content)
    opts.onProgress?.(rows.length, totalAvailable)
  }

  return { rows, truncated: totalPages > maxPages, totalAvailable }
}
