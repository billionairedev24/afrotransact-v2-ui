/**
 * Default public operating region slug (matches backend Region.code).
 * When unset or not returned by GET /regions, callers fall back to the first region from the API.
 */
const DEFAULT_PUBLIC_REGION_CODE = process.env.NEXT_PUBLIC_DEFAULT_REGION_CODE ?? ""

export function resolveDefaultRegion<T extends { code: string }>(regions: T[]): T | undefined {
  if (!regions.length) return undefined
  if (!DEFAULT_PUBLIC_REGION_CODE) return regions[0]
  return regions.find((r) => r.code === DEFAULT_PUBLIC_REGION_CODE) ?? regions[0]
}
