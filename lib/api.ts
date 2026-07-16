const API_BASE =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8080"

/** Default request budget in ms. One slow downstream shouldn't hang the UI forever. */
const DEFAULT_TIMEOUT_MS = 15_000

interface FetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown
  token?: string
  /**
   * Opt-in Next.js cache hints for Server Component fetches.
   * Pass `revalidate` (seconds) and/or `tags` to make the fetch cacheable.
   * If provided, this overrides the default `cache: "no-store"` behavior.
   */
  next?: { revalidate?: number | false; tags?: string[] }
  /** Override the default request timeout. Pass 0 to disable. */
  timeoutMs?: number
}

/**
 * In-browser hook for a global 401 handler. Set once from the SessionGuard so
 * the api layer can trigger a re-auth when the backend rejects our token,
 * without coupling api.ts to next-auth or react-router.
 */
let on401Handler: (() => void) | null = null
export function setOn401Handler(fn: (() => void) | null) {
  on401Handler = fn
}

async function api<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { body, token, headers: extraHeaders, next, cache, signal, timeoutMs, ...rest } = opts

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extraHeaders as Record<string, string>),
  }
  if (token) headers["Authorization"] = `Bearer ${token}`

  // When Server Components want a cached fetch, pass `next: { revalidate, tags }`.
  // Otherwise default to fresh data (no-store) for authenticated/mutating calls.
  const cacheOpts: Pick<RequestInit, "cache" | "next"> = next
    ? { next }
    : { cache: cache ?? "no-store" }

  // Wire a timeout AbortController and chain it with the caller-supplied signal,
  // so callers (e.g. TanStack Query cancellation) and our timeout both fire.
  const budget = timeoutMs ?? DEFAULT_TIMEOUT_MS
  const timeoutCtrl = new AbortController()
  const timer = budget > 0 ? setTimeout(() => timeoutCtrl.abort(new DOMException("timeout", "TimeoutError")), budget) : null
  const composedSignal = signal
    ? anySignal([signal, timeoutCtrl.signal])
    : timeoutCtrl.signal

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...rest,
      ...cacheOpts,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: composedSignal,
    })
  } catch (err) {
    if (timer) clearTimeout(timer)
    // Distinguish caller-cancellation from our timeout vs. a network error.
    if (err instanceof DOMException && err.name === "TimeoutError") {
      console.error(`[API] ${opts.method ?? "GET"} ${path} → timeout after ${budget}ms`)
      throw new ApiError(0, `Request timed out after ${budget}ms`, path)
    }
    if (err instanceof DOMException && err.name === "AbortError") {
      // Caller cancelled — propagate as-is for TanStack Query etc.
      throw err
    }
    if (process.env.NEXT_PHASE !== "phase-production-build") {
      console.error(`[API] ${opts.method ?? "GET"} ${path} → network error`, err)
    }
    throw new ApiError(0, "Network error", path)
  } finally {
    if (timer) clearTimeout(timer)
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    let userMessage = res.statusText

    if (res.status === 502 || res.status === 503 || res.status === 504) {
      userMessage = "The service is temporarily unavailable. Please try again in a few minutes. (HTTP " + res.status + ")"
    } else if (res.status === 429) {
      userMessage = "Too many requests. Please slow down and try again in a moment."
    } else {
      try {
        const parsed = JSON.parse(text)
        userMessage = parsed.error || parsed.message || res.statusText
      } catch {
        if (text) userMessage = text
      }
    }

    // 401 from the API means our access token is no longer accepted (revoked,
    // expired beyond refresh, key rotated). Hand off to the session guard.
    if (res.status === 401 && on401Handler && typeof window !== "undefined") {
      try { on401Handler() } catch { /* don't mask the original failure */ }
    }
    // Log every API error at source so it's always captured regardless of how
    // the caller handles it. Silence during `next build`: pre-render on the
    // home / category / deals pages tries to hit the backend, and CI/CD
    // pipelines routinely build without the backend up. The safe() wrappers
    // upstream fall back to empty data anyway.
    if (process.env.NEXT_PHASE !== "phase-production-build") {
      console.error(`[API] ${opts.method ?? "GET"} ${path} → ${res.status}`, userMessage)
    }
    throw new ApiError(res.status, userMessage, path)
  }

  if (res.status === 204) return undefined as T

  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text)
}

/** Combine multiple AbortSignals — the result aborts when any input aborts. */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const ctrl = new AbortController()
  for (const s of signals) {
    if (s.aborted) {
      ctrl.abort(s.reason)
      return ctrl.signal
    }
    s.addEventListener("abort", () => ctrl.abort(s.reason), { once: true })
  }
  return ctrl.signal
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: string,
    public path: string,
  ) {
    super(`API ${path} returned ${status}: ${body}`)
    this.name = "ApiError"
  }
}

// ── Product Catalog ──

export interface ProductVariant {
  id: string
  sku: string
  name: string
  price: number
  compareAtPrice: number | null
  currency: string
  stockQuantity: number
  options: string | null
  weightKg: number | null
  /** Parcel dimensions per unit for carrier rating (inches). */
  lengthIn?: number | null
  widthIn?: number | null
  heightIn?: number | null
  createdAt: string
}

export interface ProductImage {
  id: string
  url: string
  altText: string | null
  sortOrder: number
}

export interface CategoryRef {
  id: string
  name: string
  slug: string
  parentId: string | null
  sortOrder: number
  children?: CategoryRef[]
}

export interface Product {
  id: string
  storeId: string
  title: string
  description: string
  slug: string
  status: string
  productType: string
  attributes: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  variants: ProductVariant[]
  images: ProductImage[]
  categories: CategoryRef[]
  // Phase 9.7 — when this offer was created via "Add from catalog",
  // catalogItemId links back to the master catalog item. /product/{slug}
  // server-redirects to /p/{catalog-slug} when this is set.
  catalogItemId?: string | null
}

export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export function getProductBySlug(slug: string, opts?: { revalidate?: number }) {
  return api<Product>(`/api/v1/products/slug/${slug}`, {
    next: opts?.revalidate !== undefined
      ? { revalidate: opts.revalidate, tags: [`product:${slug}`] }
      : undefined,
  })
}

export function getProductById(id: string, opts?: { revalidate?: number }) {
  return api<Product>(`/api/v1/products/${id}`, {
    next: opts?.revalidate !== undefined
      ? { revalidate: opts.revalidate, tags: [`product:${id}`] }
      : undefined,
  })
}

export function getStoreProducts(storeId: string, page = 0, size = 20) {
  return api<Page<Product>>(`/api/v1/products/store/${storeId}?page=${page}&size=${size}&sort=createdAt,desc`)
}

export function getCategories(opts?: { revalidate?: number }) {
  return api<CategoryRef[]>("/api/v1/categories", {
    next: opts?.revalidate !== undefined ? { revalidate: opts.revalidate, tags: ["categories"] } : undefined,
  })
}

export function createCategory(token: string, data: { name: string; slug?: string; parentId?: string; sortOrder?: number }) {
  return api<CategoryRef>("/api/v1/categories", { method: "POST", body: data, token })
}

export function updateCategory(token: string, id: string, data: { name: string; slug?: string; sortOrder?: number }) {
  return api<CategoryRef>(`/api/v1/categories/${id}`, { method: "PUT", body: data, token })
}

export function deleteCategory(token: string, id: string) {
  return api<void>(`/api/v1/categories/${id}`, { method: "DELETE", token })
}

// ── Search ──

export interface SearchResult {
  product_id: string
  store_id: string
  store_name: string
  title: string
  description: string
  product_type: string
  categories: string[]
  min_price: number
  max_price: number
  currency: string
  in_stock: boolean
  image_url: string | null
  avg_rating: number
  review_count: number
  distance_miles: number | null
  /** True when the product's store is farther than the configured SHIP_DISTANCE_LIMIT_MILES.
   *  Nationwide / no-location products are never flagged. Storefront routes flagged
   *  results through a "chat support to arrange shipping" affordance. */
  beyond_ship_limit?: boolean
  highlight_title: string | null
  highlight_description: string | null
  score: number | null
  slug?: string
  // Phase 9.6b — when this result is a collapsed catalog item group,
  // catalog_item_id is shared across the offer roster and offer_count
  // is the group size. Storefront uses these to badge "X sellers" and
  // to link to /p/[slug] (catalog PDP) instead of /product/[slug].
  catalog_item_id?: string | null
  offer_count?: number
}

export interface SearchFacetBucket {
  key: string
  label: string
  count: number
}

export interface SearchFacets {
  categories: SearchFacetBucket[]
  price_ranges: SearchFacetBucket[]
  ratings: SearchFacetBucket[]
  stores: SearchFacetBucket[]
}

export interface SearchResponse {
  results: SearchResult[]
  total: number
  page: number
  page_size: number
  facets: SearchFacets
  did_you_mean: string | null
}

export function searchProducts(params: Record<string, string>, opts?: { revalidate?: number }) {
  const qs = new URLSearchParams(params).toString()
  return api<SearchResponse>(`/api/v1/search?${qs}`, {
    next: opts?.revalidate !== undefined ? { revalidate: opts.revalidate, tags: ["search"] } : undefined,
  })
}

// ── Autocomplete suggestions ──

export interface SearchSuggestion {
  text: string
  product_id: string
  /** Present when search service returns it; prefer for /product/[slug] URLs */
  slug?: string
  image_url: string | null
  category: string
  price: number
}

export interface SuggestResponse {
  suggestions: SearchSuggestion[]
}

export function searchSuggest(q: string, size = 12) {
  return api<SuggestResponse>(`/api/v1/search/suggest?q=${encodeURIComponent(q)}&size=${size}`)
}

// ── Cart (Order service) ──

export interface CartItemDto {
  id: string
  variantId: string
  productId: string
  storeId: string
  quantity: number
  unitPriceCents: number
  lineTotalCents: number
  productTitle?: string
  variantName?: string
  imageUrl?: string
  weightKg?: number | null
  lengthIn?: number | null
  widthIn?: number | null
  heightIn?: number | null
}

export interface CartDto {
  id: string
  userId: string
  items: CartItemDto[]
  subtotalCents: number
  itemCount: number
}

export function getCart(token: string) {
  return api<CartDto>("/api/v1/cart", { token })
}

export function addToCart(
  token: string,
  item: {
    variantId: string
    productId: string
    storeId: string
    quantity: number
    unitPriceCents: number
    productTitle?: string
    variantName?: string
    imageUrl?: string
    weightKg?: number | null
    lengthIn?: number | null
    widthIn?: number | null
    heightIn?: number | null
  },
) {
  return api<CartDto>("/api/v1/cart/items", { method: "POST", body: item, token })
}

export function updateCartItemQty(token: string, itemId: string, quantity: number) {
  return api<CartDto>(`/api/v1/cart/items/${itemId}`, {
    method: "PATCH",
    body: { quantity },
    token,
  })
}

export function removeCartItem(token: string, itemId: string) {
  return api<CartDto>(`/api/v1/cart/items/${itemId}`, { method: "DELETE", token })
}

export function mergeCart(
  token: string,
  items: {
    variantId: string; productId: string; storeId: string; quantity: number; unitPriceCents: number;
    productTitle?: string; variantName?: string; imageUrl?: string; weightKg?: number | null;
    lengthIn?: number | null; widthIn?: number | null; heightIn?: number | null;
  }[],
) {
  return api<CartDto>("/api/v1/cart/merge", { method: "POST", body: items, token })
}

export function clearServerCart(token: string) {
  return api<void>("/api/v1/cart", { method: "DELETE", token })
}

// ── Stores (Seller service) ──

export interface StoreInfo {
  id: string
  name: string
  slug: string
  description: string | null
  logoUrl: string | null
  bannerUrl: string | null
  rating: number
  reviewCount: number
  addressLine1?: string | null
  addressCity?: string | null
  addressState?: string | null
  addressZip?: string | null
  deliveryRadiusMiles?: number
  returnsSupported?: boolean
  returnWindowDays?: number | null
}

export function getAllStores(opts?: { revalidate?: number }) {
  return api<StoreInfo[]>("/api/v1/stores", {
    next: opts?.revalidate !== undefined ? { revalidate: opts.revalidate, tags: ["stores"] } : undefined,
  })
}

export function getStoreById(id: string, opts?: { revalidate?: number }) {
  return api<StoreInfo>(`/api/v1/stores/${id}`, {
    next: opts?.revalidate !== undefined
      ? { revalidate: opts.revalidate, tags: [`store:${id}`] }
      : undefined,
  })
}

export function getStoreBySlug(slug: string, opts?: { revalidate?: number }) {
  return api<StoreInfo>(`/api/v1/stores/slug/${slug}`, {
    next: opts?.revalidate !== undefined
      ? { revalidate: opts.revalidate, tags: [`store:${slug}`] }
      : undefined,
  })
}

// ── Reviews ──

export interface Review {
  id: string
  product_id: string
  user_id: string
  store_id: string | null
  rating: number
  title: string | null
  body: string | null
  verified_purchase: boolean
  seller_reply: string | null
  seller_reply_at: string | null
  created_at: string
}

export interface AdminReviewAnalyticsExtended {
  totalReviews: number
  avgRating: number
  verifiedReviews: number
  verifiedRate: number
  reviewsLast30Days: number
  repliedReviews: number
  replyRate: number
  distribution: Record<string, number>
  trend: { week: string; count: number; avgRating: number }[]
  topProducts: { productId: string; reviewCount: number; avgRating: number }[]
  topStores: { storeId: string; reviewCount: number; avgRating: number }[]
}

export function getAdminReviewAnalyticsExtended(token: string) {
  return api<AdminReviewAnalyticsExtended>("/api/v1/reviews/admin/analytics", { token })
}

export function replyToReview(token: string, reviewId: string, reply: string) {
  return api<Review>(`/api/v1/reviews/${reviewId}/reply`, {
    method: "PATCH",
    body: { reply },
    token,
  })
}

export interface ProductReviewsResponse {
  product_id: string
  avg_rating: number
  review_count: number
  distribution: Record<string, number>
  reviews: Review[]
  page: number
  size: number
  total: number
}

export function getProductReviews(productId: string, page = 1, size = 20) {
  return api<ProductReviewsResponse>(`/api/v1/reviews/product/${productId}?page=${page}&size=${size}`)
}

export function createReview(token: string, data: { product_id: string; rating: number; title?: string; body?: string }) {
  return api<Review>("/api/v1/reviews", { method: "POST", token, body: data })
}

export function checkReviewEligibility(token: string, productId: string) {
  return api<{ eligible: boolean; purchased: boolean; already_reviewed: boolean }>(
    `/api/v1/reviews/eligibility/${productId}`, { token }
  )
}

export function getReviewsByProducts(productIds: string[], page = 1, size = 20) {
  return api<ProductReviewsResponse>(`/api/v1/reviews/by-products?product_ids=${productIds.join(",")}&page=${page}&size=${size}`)
}

export interface ProductRatingSummary {
  productId: string
  avgRating: number
  reviewCount: number
}

/** Per-product avg-rating + review-count for a batch of products. Used by /deals
 *  to power the Customer Rating filter. Products with no reviews are omitted. */
export async function getRatingAggregatesByProducts(
  productIds: string[]
): Promise<ProductRatingSummary[]> {
  if (productIds.length === 0) return []
  // Review service returns snake_case product_id / avg_rating / review_count;
  // remap to the camelCase shape the UI uses everywhere else.
  const raw = await api<Array<{ product_id: string; avg_rating: number; review_count: number }>>(
    `/api/v1/reviews/aggregates-by-products?product_ids=${productIds.join(",")}`
  )
  return raw.map((r) => ({
    productId: r.product_id,
    avgRating: r.avg_rating,
    reviewCount: r.review_count,
  }))
}

export function getAdminReviews(token: string, page = 1, size = 50) {
  return api<ProductReviewsResponse>(`/api/v1/reviews/admin/all?page=${page}&size=${size}`, { token })
}

// ── Seller ──

export interface SellerInfo {
  id: string
  userId: string
  businessName: string
  entityType: string | null
  status: string
  onboardingStatus: string
  onboardingStep: number
  stripeAccountId: string | null
  chargesEnabled: boolean
  payoutsEnabled: boolean
  stripeRequirementsDue: boolean
  stripeDisabledReason: string | null
  lifecycleStage: string | null
  currentlyDueItems: string[] | null
  pastDueItems: string[] | null
  currentDeadline: string | null
  commissionRate: number
  contactEmail: string | null
  createdAt: string
  submittedAt: string | null
  approvedAt: string | null
  suspensionReason?: string | null
  suspendedAt?: string | null
}

/** @throws {ApiError} 204 when user has no seller profile (backend returns No Content). */
export async function getCurrentSeller(token: string): Promise<SellerInfo> {
  const body = await api<SellerInfo | undefined>("/api/v1/seller/me", { token })
  if (!body) {
    throw new ApiError(204, "Not registered as seller", "/api/v1/seller/me")
  }
  return body
}

export function registerSeller(token: string, businessName: string, taxId?: string, contactEmail?: string) {
  return api<SellerInfo>("/api/v1/seller/register", {
    method: "POST",
    body: { businessName, taxId, contactEmail },
    token,
  })
}

export function getOnboardingLink(token: string) {
  return api<{ url: string; accountId: string }>("/api/v1/seller/me/onboarding", { token })
}

/** Generates a Stripe ACCOUNT_UPDATE link so the seller can fix pending requirements. */
export function getStripeUpdateLink(token: string) {
  return api<{ url: string }>("/api/v1/seller/me/stripe-update-link", { method: "POST", token })
}

// ── Admin: Payment settings ──

export interface PaymentSettings {
  settlement_days: number
  platform_commission_rate: number
  auto_payouts_enabled: boolean
  minimum_payout_amount_cents: number
  maximum_payout_amount_cents: number
}

/** Admin-only read (same payload as internal GET /api/v1/internal/settings/payment). */
export function getPaymentSettings(token: string) {
  return api<PaymentSettings>("/api/v1/admin/settings/payment", { token })
}

export function updatePaymentSettings(token: string, data: PaymentSettings) {
  return api<PaymentSettings>("/api/v1/admin/settings/payment", { method: "PUT", body: data, token })
}

// ── Admin: Store shipping diagnostics ────────────────────────────────────

export type StoreShippingMode = "unlimited" | "radius" | "regions"

export interface AdminStoreShippingRow {
  storeId: string
  name: string | null
  slug: string | null
  shippingMode: StoreShippingMode
  shippingRadiusMeters: number | null
  regionCount: number
  originGeocoded: boolean
  stuckReason: string | null
}

export function listAdminStoreShipping(token: string) {
  return api<AdminStoreShippingRow[]>("/api/v1/admin/stores/shipping", { token })
}

export function setAdminStoreShippingMode(token: string, storeId: string, mode: StoreShippingMode) {
  return api<{ storeId: string; shippingMode: StoreShippingMode }>(
    `/api/v1/admin/stores/shipping/${storeId}/mode`,
    { method: "POST", body: { mode }, token },
  )
}

// ── Admin: Alerts settings (Slack webhook) ──

export interface AlertsSettings {
  slack_enabled: boolean
  slack_webhook_url: string
}

export function getAlertsSettings(token: string) {
  return api<AlertsSettings>("/api/v1/admin/settings/alerts", { token })
}

export function updateAlertsSettings(token: string, data: AlertsSettings) {
  return api<AlertsSettings>("/api/v1/admin/settings/alerts", { method: "PUT", body: data, token })
}

// ── Seller Onboarding (multi-step) ──

export interface OnboardingPrincipal {
  id?: string
  role: string
  firstName: string
  lastName: string
  title?: string
  ownershipPct?: number
  email?: string
  phone?: string
  dateOfBirth?: string
  ssnLast4?: string
  addressLine1?: string
  addressCity?: string
  addressState?: string
  addressZip?: string
  addressCountry?: string
}

export interface OnboardingProgress {
  sellerId: string
  currentStep: number
  onboardingStatus: string
  status: string
  businessInfo: {
    businessName: string
    entityType: string | null
    businessType: string | null
    taxId: string | null
    contactPhone: string | null
    contactEmail: string | null
    website: string | null
    businessDescription: string | null
    addressLine1: string | null
    addressLine2: string | null
    city: string | null
    state: string | null
    zip: string | null
    country: string | null
    industryCategory: string | null
    annualRevenue: string | null
    numberOfEmployees: string | null
  }
  entityDetails: {
    dateOfBirth: string | null
    ssnLast4: string | null
    ein: string | null
    stateOfIncorporation: string | null
    formationDate: string | null
    dbaName: string | null
  }
  principals: OnboardingPrincipal[]
  storeInfo: {
    storeId: string
    name: string
    slug: string
    description: string | null
    logoUrl: string | null
    bannerUrl: string | null
  } | null
  documents: OnboardingDocument[]
  subscription: {
    planId: string
    planName: string
    planSlug: string
    subscriptionStatus: string
    priceCentsPerMonth: number
  } | null
  stripe: {
    stripeAccountId: string | null
    chargesEnabled: boolean
    payoutsEnabled: boolean
    onboardingUrl: string | null
    stripeCustomerId: string | null
    hasPaymentMethod: boolean
    setupIntentClientSecret: string | null
  }
  createdAt: string
  submittedAt: string | null
  rejectionReason: string | null
}

export interface OnboardingDocument {
  id: string
  documentType: string
  fileUrl: string
  fileName: string
  fileSizeBytes: number | null
  mimeType: string | null
  status: string
  adminNotes: string | null
  createdAt: string
}

export function startOnboarding(token: string) {
  return api<OnboardingProgress>("/api/v1/seller/onboarding/start", { method: "POST", token })
}

// ── Business-type change requests (post-submit revalidation) ─────────────────

export interface BusinessTypeChangeRequestDto {
  id: string
  sellerId: string
  currentBusinessType: string
  newBusinessType: string
  currentEntityType?: string | null
  newEntityType?: string | null
  justification: string
  documentRefs: string[]
  status: "pending" | "needs_more_info" | "approved" | "rejected" | "withdrawn"
  adminNotes?: string | null
  infoRequest?: string | null
  submittedAt: string
  resolvedAt?: string | null
  resolvedByAdminId?: string | null
}

export function submitBusinessTypeChange(
  token: string,
  data: {
    newBusinessType: string
    newEntityType?: string
    justification: string
    documentRefs?: string[]
  },
) {
  return api<BusinessTypeChangeRequestDto>("/api/v1/sellers/me/business-type-change", {
    method: "POST",
    body: data,
    token,
  })
}

/** Returns the current open request, or `null` if none. The backend returns
 *  `{}` for "no open request" — we normalize that to null here so callers
 *  don't have to special-case the empty-object shape. */
export async function getOpenBusinessTypeChange(token: string): Promise<BusinessTypeChangeRequestDto | null> {
  const r = await api<BusinessTypeChangeRequestDto | Record<string, never>>(
    "/api/v1/sellers/me/business-type-change/open",
    { token },
  )
  return r && "id" in r ? (r as BusinessTypeChangeRequestDto) : null
}

export function withdrawBusinessTypeChange(token: string, requestId: string) {
  return api<BusinessTypeChangeRequestDto>(
    `/api/v1/sellers/me/business-type-change/${requestId}/withdraw`,
    { method: "POST", token },
  )
}

// ── Admin: business-type change requests ─────────────────────────────────────

export interface PagedBusinessTypeChangeRequests {
  content: BusinessTypeChangeRequestDto[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export function adminListBusinessTypeChangeRequests(
  token: string,
  opts: { status?: string[]; page?: number; size?: number } = {},
) {
  const params = new URLSearchParams()
  if (opts.status?.length) opts.status.forEach((s) => params.append("status", s))
  if (opts.page != null) params.set("page", String(opts.page))
  if (opts.size != null) params.set("size", String(opts.size))
  const qs = params.toString()
  return api<PagedBusinessTypeChangeRequests>(
    `/api/v1/admin/business-type-change-requests${qs ? `?${qs}` : ""}`,
    { token },
  )
}

export function adminResolveBusinessTypeChange(
  token: string,
  requestId: string,
  body: { decision: "approved" | "rejected" | "needs_more_info"; adminNotes?: string; infoRequest?: string },
) {
  return api<BusinessTypeChangeRequestDto>(
    `/api/v1/admin/business-type-change-requests/${requestId}/resolve`,
    { method: "POST", body, token },
  )
}

// ── Admin: Accounting / Ledger ───────────────────────────────────────────────
// Routes through the gateway via /api/v1/admin/ledger → accounting service.

export interface AccountBalanceDto {
  code: string
  type: string
  balanceCents: number
  currency: string
  asOf: string | null
}

export interface SellerLedgerBalanceDto {
  sellerId: string
  payableCents: number
  owedToPlatformCents: number
  netOwedToSellerCents: number
  asOf: string | null
}

/** Pre-seeded chart of accounts — see V2__seed_platform_accounts.sql. */
export const ACCOUNTING_ACCOUNTS: { code: string; label: string }[] = [
  { code: "stripe.platform_balance",        label: "Stripe platform balance" },
  { code: "stripe.in_transit",              label: "Stripe in-transit" },
  { code: "bank.operating",                 label: "Operating bank account" },
  { code: "refund_liability",               label: "Refund liability" },
  { code: "chargeback_reserve",             label: "Chargeback reserve" },
  { code: "platform.commission_revenue",    label: "Commission revenue" },
  { code: "platform.subscription_revenue",  label: "Subscription revenue" },
  { code: "platform.fee_revenue",           label: "Fee revenue" },
  { code: "platform.refund_expense",        label: "Refund expense" },
  { code: "platform.stripe_fees",           label: "Stripe fees" },
  { code: "platform.bad_debt",              label: "Bad debt" },
]

export interface LedgerSummaryDto {
  platformBalanceCents: number
  commissionRevenueCents: number
  totalSellerPayableCents: number
  totalSellerOwedToPlatformCents: number
  journalEntryCount: number
  topSellers: Array<{ seller_id: string; payable_cents: number }>
  error?: string
}

export function adminLedgerSummary(token: string) {
  return api<LedgerSummaryDto>(`/api/v1/admin/ledger/summary`, { token })
}

export function adminLedgerBackfill(token: string) {
  return api<{
    paymentsPosted: number
    paymentsSkipped: number
    refundsPosted: number
    refundsSkipped: number
  }>(`/api/v1/admin/ledger/backfill`, { method: "POST", token })
}

export function adminLedgerAccountBalance(token: string, code: string) {
  return api<AccountBalanceDto>(
    `/api/v1/admin/ledger/accounts/${encodeURIComponent(code)}/balance`,
    { token },
  )
}

export function adminLedgerSellerBalance(token: string, sellerId: string) {
  return api<SellerLedgerBalanceDto>(`/api/v1/admin/ledger/seller/${sellerId}/balance`, { token })
}

// ── Admin: ledger journal + trial balance ─────────────────────────────────────
export interface JournalLineDto {
  accountCode: string | null
  accountType: string | null
  direction: "DR" | "CR"
  amountCents: number
  currency: string
  orderId: string | null
  sellerId: string | null
  refundId: string | null
}
export interface JournalEntryRow {
  id: string
  postedAt: string
  eventType: string
  eventId: string
  description: string | null
  orderId: string | null
  totalDebitsCents: number
  totalCreditsCents: number
  balanced: boolean
  lines: JournalLineDto[]
}
export interface JournalPage {
  total: number
  limit: number
  offset: number
  entries: JournalEntryRow[]
}
export function adminLedgerJournal(
  token: string,
  params: { from?: string; to?: string; eventType?: string; account?: string; limit?: number; offset?: number } = {},
) {
  const q = new URLSearchParams()
  if (params.from) q.set("from", params.from)
  if (params.to) q.set("to", params.to)
  if (params.eventType) q.set("eventType", params.eventType)
  if (params.account) q.set("account", params.account)
  q.set("limit", String(params.limit ?? 50))
  q.set("offset", String(params.offset ?? 0))
  return api<JournalPage>(`/api/v1/admin/ledger/journal?${q.toString()}`, { token })
}

export interface TrialBalanceRow {
  code: string
  name: string
  type: string
  partyId: string | null
  debitCents: number
  creditCents: number
}
export interface TrialBalance {
  asOf: string | null
  currency: string
  rows: TrialBalanceRow[]
  byType: Record<string, { debitCents: number; creditCents: number }>
  totalDebitsCents: number
  totalCreditsCents: number
  balanced: boolean
  outOfBalanceCents: number
  incomeStatement: { revenueCents: number; expenseCents: number; netIncomeCents: number }
  house: {
    salesRevenueCents: number
    cogsCents: number
    grossProfitCents: number
    grossMarginPct: number
    inventoryBookValueCents: number
  }
}
export function adminLedgerTrialBalance(token: string, asOf?: string) {
  const q = asOf ? `?asOf=${encodeURIComponent(asOf)}` : ""
  return api<TrialBalance>(`/api/v1/admin/ledger/trial-balance${q}`, { token })
}

export interface LedgerAdjustmentLine {
  accountCode: string
  direction: "DR" | "CR"
  amountCents: number
  currency?: string
  sellerId?: string
  orderId?: string
  refundId?: string
}

export function adminLedgerAdjust(
  token: string,
  body: { idempotencyKey: string; reason: string; lines: LedgerAdjustmentLine[] },
) {
  return api(`/api/v1/admin/ledger/adjustments`, { method: "POST", body, token })
}

// ── Admin: Refunds ───────────────────────────────────────────────────────────
// Payment service is routed through the gateway under /api/v1/admin/refunds
// — uses the standard api() client.

export interface RefundDto {
  id: string
  paymentId: string
  orderId: string
  subOrderId: string | null
  amountCents: number
  currency: string
  stripeRefundId: string | null
  status: "pending" | "succeeded" | "failed" | "cancelled"
  reason: string
  initiatedBy: "buyer" | "seller" | "admin" | "system"
  initiatedByUserId: string | null
  reverseTransfer: boolean
  failureMessage: string | null
  createdAt: string
  succeededAt: string | null
  failedAt: string | null
}

export function adminCreateRefund(
  token: string,
  body: {
    orderId?: string
    orderNumber?: string
    subOrderId?: string
    amountCents: number
    reason: string
    idempotencyKey: string
    reverseTransfer?: boolean
    notes?: string
  },
) {
  return api<RefundDto>(`/api/v1/admin/refunds`, { method: "POST", body, token })
}

export function adminListRefundsByOrder(token: string, orderId: string) {
  return api<RefundDto[]>(`/api/v1/admin/refunds/by-order/${orderId}`, { token })
}

export function adminListRefundsByOrderNumber(token: string, orderNumber: string) {
  return api<RefundDto[]>(`/api/v1/admin/refunds/by-order-number/${orderNumber}`, { token })
}

// ── Returns (buyer + seller) ─────────────────────────────────────────────────

export type ReturnStatus =
  | "requested" | "approved" | "approved_partial" | "denied"
  | "label_issued" | "in_transit" | "received" | "inspected"
  | "completed" | "rejected_on_inspection" | "cancelled" | "expired"

export type ReturnReason =
  | "damaged" | "wrong_item" | "not_as_described" | "no_longer_wanted" | "other"

export interface ReturnDto {
  id: string
  orderId: string
  orderNumber: string
  subOrderId: string
  storeId: string
  requestedByUserId: string
  status: ReturnStatus
  reason: ReturnReason
  buyerNotes?: string | null
  sellerNotes?: string | null
  decisionReason?: string | null
  photoUrls: string[]
  refundAmountCents?: number | null
  restockingFeeCents: number
  restockingFeeBps?: number | null
  returnLabelUrl?: string | null
  returnTrackingNumber?: string | null
  returnLabelCarrier?: string | null
  sellerResponseDueAt: string
  sellerRespondedAt?: string | null
  receivedAt?: string | null
  completedAt?: string | null
  refundId?: string | null
  refundStatus?: string | null
  createdAt: string
  items: Array<{
    id: string
    orderItemId: string
    productId?: string | null
    variantId?: string | null
    quantity: number
    refundAmountCents: number
  }>
}

export interface CreateReturnRequest {
  orderNumber: string
  subOrderId: string
  reason: ReturnReason
  buyerNotes?: string
  photoUrls?: string[]
  items: Array<{ orderItemId: string; quantity: number }>
}

export function requestReturn(token: string, body: CreateReturnRequest) {
  return api<ReturnDto>(`/api/v1/returns`, { method: "POST", body, token })
}

export interface PagedReturns {
  content: ReturnDto[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export function listMyReturns(token: string, page = 0, size = 20) {
  return api<PagedReturns>(`/api/v1/returns/me?page=${page}&size=${size}`, { token })
}

export function cancelReturn(token: string, returnId: string) {
  return api<ReturnDto>(`/api/v1/returns/${returnId}/cancel`, { method: "POST", token })
}

export function sellerListReturns(token: string, storeId: string, status?: ReturnStatus[], page = 0, size = 20) {
  const params = new URLSearchParams()
  params.set("page", String(page))
  params.set("size", String(size))
  if (status?.length) status.forEach((s) => params.append("status", s))
  return api<PagedReturns>(`/api/v1/returns/store/${storeId}?${params}`, { token })
}

export function sellerDecideReturn(
  token: string,
  storeId: string,
  returnId: string,
  body: {
    decision: "approve" | "approve_partial" | "deny"
    refundAmountCents?: number
    restockingFeeBps?: number
    reason?: string
    sellerNotes?: string
    provideLabel?: boolean
  },
) {
  return api<ReturnDto>(`/api/v1/returns/${returnId}/decide`, {
    method: "POST",
    body,
    token,
    headers: { "X-Store-Id": storeId },
  })
}

export function sellerMarkReturnReceived(token: string, storeId: string, returnId: string) {
  return api<ReturnDto>(`/api/v1/returns/${returnId}/received`, {
    method: "POST",
    token,
    headers: { "X-Store-Id": storeId },
  })
}

export function sellerInspectReturn(
  token: string,
  storeId: string,
  returnId: string,
  body: { rejectOnInspection?: boolean; reason?: string; damageReductionCents?: number },
) {
  return api<ReturnDto>(`/api/v1/returns/${returnId}/inspect`, {
    method: "POST",
    body,
    token,
    headers: { "X-Store-Id": storeId },
  })
}

// ── Admin: Order lookup + refund queue ───────────────────────────────────────

export interface AdminOrderLookup {
  id: string
  orderNumber: string
  status: string
  buyerId: string
  totalCents: number
  subtotalCents: number
  taxCents: number
  shippingCostCents: number
  discountCents: number
  currency: string
  recipientName?: string | null
  shipLine1?: string | null
  shipCity?: string | null
  shipStateRegion?: string | null
  shipPostalCode?: string | null
  shipCountryCode?: string | null
  shipPhone?: string | null
  placedAt: string | null
  createdAt: string
  subOrders?: Array<{
    id: string
    storeId: string
    fulfillmentStatus?: string | null
    subtotalCents: number
  }>
}

export function adminGetOrderByNumber(token: string, orderNumber: string) {
  return api<AdminOrderLookup>(`/api/v1/orders/admin/by-number/${orderNumber}`, { token })
}

export interface PagedAdminOrders {
  content: AdminOrderLookup[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export function adminGetRefundQueue(token: string, page = 0, size = 20) {
  return api<PagedAdminOrders>(`/api/v1/orders/admin/refund-queue?page=${page}&size=${size}`, { token })
}

export function getOnboardingProgress(token: string) {
  return api<OnboardingProgress>("/api/v1/seller/onboarding", { token })
}

export function updateOnboardingBusiness(token: string, data: {
  businessName: string; entityType: string; businessType?: string; taxId?: string;
  contactPhone?: string; contactEmail?: string; website?: string; businessDescription?: string;
  addressLine1: string; addressLine2?: string; city: string; state: string; zip: string; country?: string;
  dateOfBirth?: string; ssnLast4?: string; ein?: string; stateOfIncorporation?: string;
  formationDate?: string; dbaName?: string; industryCategory?: string; annualRevenue?: string;
  numberOfEmployees?: string; principals?: OnboardingPrincipal[];
}) {
  return api<OnboardingProgress>("/api/v1/seller/onboarding/business", { method: "PUT", body: data, token })
}

export function updateOnboardingStore(token: string, data: {
  name: string; description?: string; logoUrl?: string; bannerUrl?: string;
  regionId?: string; addressLine1?: string; city?: string; state?: string;
  zip?: string; deliveryRadiusMiles?: number;
}) {
  return api<OnboardingProgress>("/api/v1/seller/onboarding/store", { method: "PUT", body: data, token })
}

export function addOnboardingDocument(token: string, params: {
  documentType: string; fileUrl: string; fileName: string; fileSizeBytes?: number; mimeType?: string;
}) {
  return api<OnboardingProgress>("/api/v1/seller/onboarding/documents", {
    method: "POST",
    token,
    body: params,
  })
}

export function removeOnboardingDocument(token: string, documentId: string) {
  return api<OnboardingProgress>(`/api/v1/seller/onboarding/documents/${documentId}`, { method: "DELETE", token })
}

export function chooseOnboardingSubscription(token: string, planSlug: string) {
  return api<OnboardingProgress>(`/api/v1/seller/onboarding/subscription?planSlug=${planSlug}`, { method: "PUT", token })
}

export function setupOnboardingStripe(token: string) {
  return api<OnboardingProgress>("/api/v1/seller/onboarding/stripe", { method: "POST", token })
}

export function refreshOnboardingStripeStatus(token: string) {
  return api<OnboardingProgress>("/api/v1/seller/onboarding/stripe/refresh-status", { method: "POST", token })
}

export function getSetupIntentSecret(token: string) {
  return api<{ clientSecret: string }>("/api/v1/seller/onboarding/stripe/setup-intent", { token })
}

export function confirmOnboardingPaymentMethod(token: string, paymentMethodId: string) {
  return api<OnboardingProgress>(`/api/v1/seller/onboarding/stripe/confirm-payment-method?paymentMethodId=${paymentMethodId}`, { method: "POST", token })
}

export function submitOnboardingForReview(
  token: string,
  body: { signedName: string; termsVersion: string }
) {
  return api<OnboardingProgress>("/api/v1/seller/onboarding/submit", {
    method: "POST",
    token,
    body,
  })
}

// ── Admin Seller Management (enhanced) ──

export interface OnboardingStats {
  totalSellers: number
  started: number
  inProgress: number
  submitted: number
  underReview: number
  approved: number
  rejected: number
  needsAction: number
}

export interface AdminSellerDetail {
  id: string
  userId: string
  businessName: string
  entityType: string | null
  businessType: string | null
  taxId: string | null
  contactPhone: string | null
  contactEmail: string | null
  website: string | null
  businessDescription: string | null
  businessAddress: string
  status: string
  onboardingStatus: string
  onboardingStep: number
  stripeAccountId: string | null
  stripeCustomerId: string | null
  stripeDefaultPmId: string | null
  stripeConnectCountry: string | null
  stripeConnectBusinessType: string | null
  chargesEnabled: boolean
  payoutsEnabled: boolean
  commissionRate: number
  rejectionReason: string | null
  suspensionReason: string | null
  suspendedAt: string | null
  testAccount: boolean | null
  // Stripe Connect lifecycle snapshot — populated by the seller-service
  // account.updated webhook handler. Surface in the admin UI so ops can see
  // *why* a Connect account is restricted without leaving the dashboard.
  lifecycleStage: string | null
  stripeRequirementsDue: boolean | null
  stripeDisabledReason: string | null
  currentlyDueItems: string[] | null
  pastDueItems: string[] | null
  eventuallyDueItems: string[] | null
  pendingVerificationItems: string[] | null
  currentDeadline: string | null
  lastWebhookEventAt: string | null
  adminNotes: string | null
  createdAt: string
  submittedAt: string | null
  approvedAt: string | null
  reviewedAt: string | null
  documents: OnboardingDocument[]
  stores: { id: string; name: string; slug: string; description: string | null; logoUrl: string | null }[]
}

export function getAdminSellerStats(token: string) {
  return api<OnboardingStats>("/api/v1/admin/sellers/stats", { token })
}

export function getAdminSellerDetail(token: string, id: string) {
  return api<AdminSellerDetail>(`/api/v1/admin/sellers/${id}/detail`, { token })
}

export function reviewAdminSeller(token: string, id: string, action: string, reason?: string, adminNotes?: string) {
  return api<SellerInfo>(`/api/v1/admin/sellers/${id}/review`, {
    method: "POST", body: { action, reason, adminNotes }, token,
  })
}

export interface StoreDetail {
  id: string
  sellerId: string
  name: string
  slug: string
  description: string | null
  logoUrl: string | null
  bannerUrl: string | null
  regionId: string | null
  active: boolean
  latitude: number | null
  longitude: number | null
  addressLine1: string | null
  addressCity: string | null
  addressState: string | null
  addressZip: string | null
  addressCountry?: string | null
  deliveryRadiusMiles: number
  shipFromSameAsBusiness?: boolean | null
  shipFromLine1?: string | null
  shipFromCity?: string | null
  shipFromState?: string | null
  shipFromZip?: string | null
  shipFromCountry?: string | null
  allowedCarriers?: string[] | null
  returnsSupported?: boolean
  returnWindowDays?: number | null
  shippingMode?: "unlimited" | "radius" | "regions" | null
  shippingRadiusMeters?: number | null
  shippingRegions?: Array<{ countryCode: string; stateCode?: string | null }> | null
  originLat?: number | null
  originLng?: number | null
  createdAt: string
  updatedAt: string
}

export function getSellerStores(token: string, sellerId: string) {
  return api<StoreDetail[]>(`/api/v1/stores/seller/${sellerId}`, { token })
}

export interface SellerStoresWithQuota {
  stores: StoreDetail[]
  used: number
  /** null = unlimited */
  quota: number | null
  planSlug: string | null
  canAddStore: boolean
}

export function getSellerStoresWithQuota(token: string, sellerId: string) {
  return api<SellerStoresWithQuota>(`/api/v1/stores/seller/${sellerId}/with-quota`, { token })
}

export function createStore(token: string, data: Record<string, unknown>) {
  return api<StoreDetail>("/api/v1/stores", { method: "POST", body: data, token })
}

export function updateStore(token: string, id: string, data: Record<string, unknown>) {
  return api<StoreDetail>(`/api/v1/stores/${id}`, { method: "PUT", body: data, token })
}

// ── Seller Subscription ──

export interface SubscriptionPlan {
  id: string
  name: string
  slug: string
  description: string | null
  priceCentsPerMonth: number
  billingInterval: string
  billingCount: number
  priceDisplay: string
  maxProducts: number
  maxStores: number
  /** basic | medium | comprehensive — drives the seller analytics UI tier gate. */
  analyticsTier?: "basic" | "medium" | "comprehensive"
  commissionRateOverride: number | null
  stripePriceId: string | null
  active: boolean
  displayOrder: number
  features: string[]
}

export interface SellerSubscription {
  id: string
  sellerId: string
  plan: SubscriptionPlan
  status: string
  trialStartedAt: string | null
  trialEndsAt: string | null
  billingStartsAt: string | null
  nextBillingDate: string | null
  cancelAtPeriodEnd: boolean
  cancelledAt: string | null
  statusMessage: string | null
}

export function getSubscription(token: string) {
  return api<SellerSubscription>("/api/v1/seller/subscription", { token })
}

export function startTrial(token: string, planSlug = "starter") {
  return api<SellerSubscription>(`/api/v1/seller/subscription/start-trial?planSlug=${planSlug}`, {
    method: "POST",
    token,
  })
}

export function cancelSubscription(token: string) {
  return api<SellerSubscription>("/api/v1/seller/subscription/cancel", {
    method: "POST",
    token,
  })
}

export function changePlan(token: string, planSlug: string) {
  return api<SellerSubscription>("/api/v1/seller/subscription/plan", {
    method: "PUT",
    body: { planSlug },
    token,
  })
}

export function getPublicPlans() {
  return api<SubscriptionPlan[]>("/api/v1/seller/subscription/plans/public")
}

export function getSubscriptionSetupIntent(token: string) {
  return api<{ clientSecret: string }>("/api/v1/seller/subscription/setup-intent", { token })
}

export function confirmSubscriptionPaymentMethod(token: string, paymentMethodId: string) {
  return api<{ paymentMethodId: string; success: boolean }>(
    `/api/v1/seller/subscription/confirm-payment-method?paymentMethodId=${paymentMethodId}`,
    { method: "POST", token },
  )
}

export interface PaymentInfo {
  hasPaymentMethod: boolean
  stripeCustomerId: string | null
  stripeAccountId: string | null
  chargesEnabled: boolean
  payoutsEnabled: boolean
}

export function getPaymentInfo(token: string) {
  return api<PaymentInfo>("/api/v1/seller/subscription/payment-info", { token })
}

// ── Products (for seller creating/managing) ──

export function createProduct(
  token: string,
  data: {
    storeId: string
    title: string
    description?: string
    productType: string
    status?: string
    attributes?: string
    variants?: {
      sku: string
      name?: string
      price: number
      compareAtPrice?: number | null
      currency?: string
      stockQuantity?: number
      options?: Record<string, unknown>
      weightKg?: number
      lengthIn?: number
      widthIn?: number
      heightIn?: number
    }[]
    categoryIds?: string[]
  },
) {
  return api<Product>("/api/v1/products", { method: "POST", body: data, token })
}

export function addProductImage(
  token: string,
  productId: string,
  data: { url: string; altText?: string; sortOrder?: number },
) {
  return api<void>(`/api/v1/products/${productId}/images`, {
    method: "POST",
    body: data,
    token,
  })
}

export function deleteProductImage(token: string, imageId: string) {
  return api<void>(`/api/v1/products/images/${imageId}`, {
    method: "DELETE",
    token,
  })
}

export function addVariant(
  token: string,
  productId: string,
  data: {
    sku: string
    name?: string
    price: number
    compareAtPrice?: number | null
    currency?: string
    stockQuantity?: number
    options?: Record<string, unknown>
    weightKg?: number | null
    lengthIn?: number | null
    widthIn?: number | null
    heightIn?: number | null
  },
) {
  return api<ProductVariant>(`/api/v1/products/${productId}/variants`, {
    method: "POST",
    body: data,
    token,
  })
}

export function updateVariant(
  token: string,
  variantId: string,
  data: {
    sku: string
    name?: string
    price: number
    compareAtPrice?: number | null
    currency?: string
    stockQuantity?: number
    options?: Record<string, unknown>
    weightKg?: number | null
    lengthIn?: number | null
    widthIn?: number | null
    heightIn?: number | null
  },
) {
  return api<ProductVariant>(`/api/v1/products/variants/${variantId}`, {
    method: "PUT",
    body: data,
    token,
  })
}

export function deleteVariant(token: string, variantId: string) {
  return api<void>(`/api/v1/products/variants/${variantId}`, {
    method: "DELETE",
    token,
  })
}

export function updateProduct(token: string, id: string, data: Record<string, unknown>) {
  return api<Product>(`/api/v1/products/${id}`, { method: "PUT", body: data, token })
}

export function deleteProduct(token: string, id: string) {
  return api<void>(`/api/v1/products/${id}`, { method: "DELETE", token })
}

export async function getSellerProducts(token: string): Promise<Page<Product>> {
  const seller = await getCurrentSeller(token)
  const stores = await getSellerStores(token, seller.id)
  if (stores.length === 0) return { content: [], totalElements: 0, totalPages: 0, number: 0, size: 0 }
  return getStoreProducts(stores[0].id, 0, 200)
}

// ── Orders (seller) ──

export interface OrderItemDto {
  id: string
  variantId: string
  productId: string | null
  productTitle: string | null
  variantName: string | null
  imageUrl: string | null
  quantity: number
  unitPriceCents: number
  totalPriceCents: number
  slug?: string
}

export interface SubOrderDto {
  id: string
  storeId: string
  subtotalCents: number
  discountCents?: number
  couponCode?: string | null
  totalCents?: number
  commissionCents: number
  shippingCostCents: number
  taxCents?: number
  transferAmountCents: number
  fulfillmentStatus: string
  trackingNumber: string | null
  trackingStatus?: string | null
  trackingStatusDetail?: string | null
  shippingProvider?: string | null
  shippingQuoteId?: string | null
  shippingCarrier?: string | null
  shippingService?: string | null
  shippingLabelId?: string | null
  shippingShipmentId?: string | null
  trackingUpdatedAt?: string | null
  exceptionNote: string | null
  deliveryProofImageUrl?: string | null
  deliveryProofUploadedAt?: string | null
  items: OrderItemDto[]
}

export interface OrderDto {
  id: string
  orderNumber: string
  status: string
  subtotalCents: number
  discountCents?: number
  couponCode?: string | null
  paymentMethod?: string | null
  last4?: string | null
  taxCents: number
  shippingCostCents: number
  totalCents: number
  currency: string
  shippingAddress: string | null
  placedAt: string
  createdAt: string
  subOrders: SubOrderDto[]
}

export function getSellerOrders(token: string, storeId: string, page = 0, size = 20) {
  return api<Page<OrderDto>>(`/api/v1/orders/store/${storeId}?page=${page}&size=${size}&sort=createdAt,desc`, { token })
}

export function getBuyerOrders(token: string, page = 0, size = 20, q?: string) {
  const qParam = q && q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""
  return api<Page<OrderDto>>(`/api/v1/orders?page=${page}&size=${size}&sort=createdAt,desc${qParam}`, { token })
}

export function getOrderByNumber(token: string, orderNumber: string) {
  return api<OrderDto>(`/api/v1/orders/${orderNumber}`, { token })
}

export function getAdminOrders(token: string, page = 0, size = 20) {
  return api<Page<OrderDto>>(`/api/v1/orders/admin/all?page=${page}&size=${size}&sort=createdAt,desc`, { token })
}

export function updateSubOrderStatus(
  token: string,
  subOrderId: string,
  status: string,
  trackingNumber?: string,
  exceptionNote?: string,
) {
  const params = new URLSearchParams({ status })
  if (trackingNumber) params.set("trackingNumber", trackingNumber)
  if (exceptionNote) params.set("exceptionNote", exceptionNote)
  return api<OrderDto>(`/api/v1/orders/sub-orders/${subOrderId}/status?${params}`, { method: "PUT", token })
}

/**
 * Attach a delivery-proof photo URL to a sub-order. Backend stores the pointer;
 * the buyer only sees the image once the sub-order is marked delivered.
 */
export function attachDeliveryProof(token: string, subOrderId: string, imageUrl: string) {
  return api<OrderDto>(`/api/v1/orders/sub-orders/${subOrderId}/delivery-proof`, {
    method: "POST",
    body: { imageUrl },
    token,
  })
}

export interface CheckoutRequest {
  regionId: string
  shippingAddressId?: string
  fullName?: string
  line1?: string
  line2?: string
  city?: string
  state?: string
  zip?: string
  phone?: string
  /** When true and there is no shippingAddressId, order service saves inline fields to the buyer profile after checkout. */
  saveAddress?: boolean
  totalWeightLbs?: number
  couponCodes?: string[]
  /** Applied deal ID. Order service uses this to apply the deal discount directly from catalog
   *  (fallback for when the deal's Kafka-created coupon hasn't been consumed yet). */
  dealId?: string
  selectedShippingQuoteId?: string
  selectedShippingCarrier?: string
  selectedShippingService?: string
  selectedShippingAmountCents?: number
  /** Backlog #40: when true the payment service attaches a Stripe Customer +
   *  setup_future_usage=off_session so the card is saved on success. */
  saveCard?: boolean
}

export interface CheckoutResponse {
  orderId: string
  orderNumber: string
  subtotalCents: number
  discountCents: number
  taxCents: number
  shippingCostCents: number
  totalCents: number
  couponCode: string | null
  currency: string
  paymentClientSecret: string | null
  status: string
  /** Phase 2 session-mode: when present, no Order row exists yet — the buyer
   *  must be redirected through Stripe back to /checkout/complete?session=…
   *  where the UI polls /api/public/checkout-sessions/:id/result for the
   *  materialized order id. Omitted in legacy flow. */
  checkoutSessionId?: string | null
}

export interface ShippingQuoteOption {
  quoteId: string
  carrier: string
  serviceCode: string
  serviceName: string
  tier: "low" | "medium" | "high" | string
  amountCents: number
  currency: string
  estimatedDays: number
}

export interface ShippingQuoteGroup {
  carrier: string
  options: ShippingQuoteOption[]
}

export interface ShippingQuoteResponse {
  realtimeEnabled: boolean
  shippingProvider: string
  eligibleByGeo: boolean
  groups: ShippingQuoteGroup[]
  message?: string
  packageCount?: number
  shipmentHints?: string[]
}

export interface ShippingSettings {
  shipping_realtime_enabled: boolean
  shipping_provider: "shippo" | "easypost"
  shipping_realtime_state_allowlist: string[]
  shipping_realtime_city_allowlist: string[]
  shipping_realtime_fallback_static: boolean
  /**
   * Multi-parcel packing: max weight per parcel (lb). Null/omit = order service env default.
   * Config service + admin; order service may also read SHIPPING_PACK_MAX_WEIGHT_LBS.
   */
  shipping_pack_max_weight_lbs?: number | null
  /**
   * Multi-parcel packing: max stacked height per parcel (in). Null/omit = order service env default.
   * Config service + admin; order service may also read SHIPPING_PACK_MAX_STACK_HEIGHT_IN.
   */
  shipping_pack_max_stack_height_in?: number | null
}

// ── Coupons ──

export interface CouponData {
  id: string
  code: string
  type: "percentage" | "fixed_amount"
  value: number
  minOrderCents: number | null
  maxDiscountCents: number | null
  usageLimit: number | null
  usageCount: number
  perUserLimit: number
  scope: "site_wide" | "product" | "store" | "category"
  scopeId: string | null
  discountTarget: "items" | "shipping"
  sellerId: string | null
  regionId: string | null
  startsAt: string
  expiresAt: string
  enabled: boolean
  active: boolean
  createdAt: string
}

export interface CouponCreateRequest {
  code: string
  type: "percentage" | "fixed_amount"
  value: number
  minOrderCents?: number
  maxDiscountCents?: number
  usageLimit?: number
  perUserLimit?: number
  scope?: string
  scopeId?: string
  discountTarget?: "items" | "shipping"
  regionId?: string
  startsAt?: string
  expiresAt: string
  enabled?: boolean
}

export interface ValidateCouponResponse {
  valid: boolean
  code: string
  type: string
  value: number
  discountCents: number
  discountTarget?: "items" | "shipping"
  error: string | null
}

export function createSellerCoupon(token: string, data: CouponCreateRequest) {
  return api<CouponData>("/api/v1/seller/coupons", { method: "POST", body: data, token })
}

export function getSellerCoupons(token: string, page = 0, size = 20) {
  return api<Page<CouponData>>(`/api/v1/seller/coupons?page=${page}&size=${size}`, { token })
}

export function updateSellerCoupon(token: string, id: string, data: Partial<CouponCreateRequest>) {
  return api<CouponData>(`/api/v1/seller/coupons/${id}`, { method: "PUT", body: data, token })
}

export function deleteSellerCoupon(token: string, id: string) {
  return api<void>(`/api/v1/seller/coupons/${id}`, { method: "DELETE", token })
}

export function getAdminCoupons(token: string, page = 0, size = 20) {
  return api<Page<CouponData>>(`/api/v1/admin/coupons?page=${page}&size=${size}`, { token })
}

export function createAdminCoupon(token: string, data: CouponCreateRequest) {
  return api<CouponData>("/api/v1/admin/coupons", { method: "POST", body: data, token })
}

export function updateAdminCoupon(token: string, id: string, data: Partial<CouponCreateRequest>) {
  return api<CouponData>(`/api/v1/admin/coupons/${id}`, { method: "PUT", body: data, token })
}

export function toggleAdminCoupon(token: string, id: string) {
  return api<CouponData>(`/api/v1/admin/coupons/${id}/toggle`, { method: "POST", token })
}

export function validateCoupon(token: string, code: string, subtotalCents: number, regionId?: string, shippingCents?: number, zoneId?: string) {
  return api<ValidateCouponResponse>("/api/v1/coupons/validate", {
    method: "POST",
    // Backend prefers zoneId (coupons_enabled lives on service zones); regionId
    // is a legacy fallback. Send both when we have them — the backend picks
    // zoneId first. Mirrors the shipping-quote path.
    body: { code, subtotalCents, shippingCents, regionId, zoneId },
    token,
  })
}

export function checkout(token: string, data: CheckoutRequest, idempotencyKey?: string) {
  return api<CheckoutResponse>("/api/v1/orders/checkout", {
    method: "POST",
    body: data,
    token,
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  })
}

export interface ReorderResponse extends CheckoutResponse {
  /** Items from the prior order dropped because the catalog row is gone. */
  skippedItemCount: number
  /** True when defaults were resolved and checkout ran. False when the cart
   *  was populated but the UI must bounce to /checkout for a missing default
   *  or other prerequisite. */
  fastPath: boolean
  /** Reason for the fastPath=false fallback. Null on the happy path. */
  fallbackReason?: string | null
}

/**
 * 1-click reorder. Replays a prior order's items into the buyer's cart and,
 * when the buyer has a default shipping address, runs checkout. Returns the
 * standard checkout response (paymentClientSecret or checkoutSessionId)
 * plus fastPath/skippedItemCount signals.
 */
export function reorderOrder(token: string, orderNumber: string, idempotencyKey?: string) {
  return api<ReorderResponse>(`/api/v1/orders/${orderNumber}/reorder`, {
    method: "POST",
    token,
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  })
}

export interface ForYouProduct {
  productId: string
  variantId?: string | null
  storeId?: string | null
  name: string
  imageUrl?: string | null
  currentPriceCents: number
  currency?: string | null
  slug?: string | null
  lastOrderedAt?: string | null
  /** Live stock — UI hides the Add/Buy CTA when false. Defaults to true if omitted for backward compat. */
  inStock?: boolean
  /** Discriminator: which composer source surfaced this row. */
  source: "BUY_AGAIN" | "CO_PURCHASE" | "SEMANTIC" | "CATEGORY"
}

/**
 * Home-page "For You" rail. Composes Buy-Again + Co-purchase recommendations
 * + a category-level pad. Returns up to `limit` rows (default 12), deduped
 * across sources, ordered Buy-Again → Co-purchase → Category. Backend sets
 * Cache-Control: private, max-age=60 — the rail tolerates a minute of staleness.
 */
export function getForYouProducts(token: string, limit = 12) {
  return api<ForYouProduct[]>(`/api/v1/orders/for-you?limit=${limit}`, { token })
}

// ── Saved payment methods (Backlog #40) ──

export interface SavedPaymentMethod {
  id: string
  /** Stripe's PaymentMethod id (pm_...). Send this — not `id` — to
   *  stripe.confirmCardPayment / confirmPayment. */
  stripePmId: string
  brand: string | null
  last4: string | null
  expMonth: number | null
  expYear: number | null
  isDefault: boolean
}

export function listSavedPaymentMethods(token: string) {
  return api<SavedPaymentMethod[]>("/api/v1/payments/saved-methods", { token })
}

export function deleteSavedPaymentMethod(token: string, id: string) {
  return api<void>(`/api/v1/payments/saved-methods/${id}`, { method: "DELETE", token })
}

export function getShippingQuotes(
  token: string,
  data: {
    /** New primary key: buyer's resolved service-zone id. */
    zoneId?: string
    /** Legacy fallback while callers migrate. */
    regionId?: string
    state?: string
    city?: string
    destinationLine1?: string
    destinationZip?: string
    destinationCountry?: string
  },
) {
  return api<ShippingQuoteResponse>("/api/v1/orders/shipping/quotes", {
    method: "POST",
    body: data,
    token,
  })
}

export function getAdminShippingSettings(token: string) {
  return api<ShippingSettings>("/api/v1/admin/config/shipping", { token })
}

export function putAdminShippingSettings(token: string, data: ShippingSettings) {
  return api<ShippingSettings>("/api/v1/admin/config/shipping", { method: "PUT", body: data, token })
}

// ── Admin ──

export function getAdminPlans(token: string) {
  return api<SubscriptionPlan[]>("/api/v1/admin/subscription/plans", { token })
}

export function createAdminPlan(token: string, data: Partial<SubscriptionPlan>) {
  return api<SubscriptionPlan>("/api/v1/admin/subscription/plans", {
    method: "POST",
    body: data,
    token,
  })
}

export function updateAdminPlan(token: string, planId: string, data: Partial<SubscriptionPlan>) {
  return api<SubscriptionPlan>(`/api/v1/admin/subscription/plans/${planId}`, {
    method: "PUT",
    body: data,
    token,
  })
}

export function getBillingConfig(token: string) {
  return api<Record<string, string>>("/api/v1/admin/subscription/billing-config", { token })
}

export function updateBillingConfig(token: string, key: string, value: string) {
  return api<void>(`/api/v1/admin/subscription/billing-config/${key}`, {
    method: "PUT",
    body: { value },
    token,
  })
}

// ── Admin: Regions (Config service) ──

export interface Region {
  id: string
  code: string
  name: string
  countryCode: string
  stateOrProvince: string | null
  city: string | null
  currency: string
  timezone: string
  taxRate: number
  commissionRate: number
  shippingRateCentsPerLb: number
  freeShippingThresholdCents: number
  active: boolean
  settings: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

interface RawRegion {
  id: string
  code: string
  name: string
  country_code: string
  state_or_province: string | null
  city: string | null
  currency: string
  timezone: string
  tax_rate: number
  shipping_rate_cents_per_lb: number
  free_shipping_threshold_cents: number
  active: boolean
  settings: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

function mapRegion(r: RawRegion): Region {
  const settings = (r.settings ?? {}) as Record<string, unknown>
  return {
    id: r.id,
    code: r.code || "",
    name: r.name || r.city || "",
    countryCode: r.country_code || "US",
    stateOrProvince: r.state_or_province,
    city: r.city,
    currency: r.currency || "USD",
    timezone: r.timezone || "America/Chicago",
    taxRate: r.tax_rate,
    commissionRate: typeof settings.commission_rate === "number" ? settings.commission_rate : 10,
    shippingRateCentsPerLb: r.shipping_rate_cents_per_lb,
    freeShippingThresholdCents: r.free_shipping_threshold_cents,
    active: r.active,
    settings,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export async function getRegions(token?: string, activeOnly = false): Promise<Region[]> {
  const qs = activeOnly ? "?active=true" : ""
  const opts = token ? { token } : {}
  const res = await api<{ regions: RawRegion[] } | RawRegion[]>(`/api/v1/regions${qs}`, opts)
  const raw = Array.isArray(res) ? res : (res.regions ?? [])
  return raw.map(mapRegion)
}

export async function getAdminRegions(token: string): Promise<Region[]> {
  const res = await api<{ regions: RawRegion[] } | RawRegion[]>("/api/v1/admin/regions", { token })
  const raw = Array.isArray(res) ? res : (res.regions ?? [])
  return raw.map(mapRegion)
}

export async function createRegion(token: string, data: Record<string, unknown>): Promise<Region> {
  const raw = await api<RawRegion>("/api/v1/admin/regions", { method: "POST", body: data, token })
  return mapRegion(raw)
}

export async function updateRegion(token: string, id: string, data: Record<string, unknown>): Promise<Region> {
  const raw = await api<RawRegion>(`/api/v1/admin/regions/${id}`, { method: "PUT", body: data, token })
  return mapRegion(raw)
}

export function deleteRegion(token: string, id: string) {
  return api<void>(`/api/v1/admin/regions/${id}`, { method: "DELETE", token })
}

// ── Admin: Region features (config-service) ──
// Wire to GET/POST /api/v1/admin/regions/{id}/features. The config-service
// stores per-region toggles like `coupons_enabled` in config.region_features
// and returns them as { region_id, features: RegionFeature[] }.

export interface RegionFeature {
  id: string
  regionId: string
  featureKey: string
  enabled: boolean
}

interface RawRegionFeature {
  id: string
  region_id: string
  feature_key: string
  enabled: boolean
  config?: unknown
}

interface RawRegionFeaturesPayload {
  region_id: string
  features: RawRegionFeature[]
}

function mapRegionFeature(f: RawRegionFeature): RegionFeature {
  return {
    id: f.id,
    regionId: f.region_id,
    featureKey: f.feature_key,
    enabled: f.enabled,
  }
}

export async function getRegionFeatures(token: string, regionId: string): Promise<RegionFeature[]> {
  const raw = await api<RawRegionFeaturesPayload>(
    `/api/v1/admin/regions/${regionId}/features`,
    { token },
  )
  return (raw.features ?? []).map(mapRegionFeature)
}

export async function upsertRegionFeature(
  token: string,
  regionId: string,
  featureKey: string,
  enabled: boolean,
): Promise<void> {
  await api<{ status: string }>(`/api/v1/admin/regions/${regionId}/features`, {
    method: "POST",
    body: { feature_key: featureKey, enabled },
    token,
  })
}

// ── Admin: Service Zones (hierarchical geo-rollout) ─────────────────────────
// Backed by config-service. A zone tree replaces the flat regions table for
// feature rollout decisions. Most-specific match wins; features inherit
// from ancestors unless overridden. See services/config/handler/zone.go.

export type ZoneLevel = "country" | "subdivision" | "locality"

export interface ServiceZone {
  id: string
  parentZoneId: string | null
  code: string
  displayName: string
  countryCode: string
  subdivisionCode: string | null
  postalPattern: string | null
  status: "enabled" | "coming_soon" | "disabled"
  sortOrder: number
  level: ZoneLevel
  cityName: string | null
  currency: string | null
  timezone: string | null
  taxRate: number | null
  shippingRateCentsPerLb: number | null
  freeShippingThresholdCents: number | null
  shippingMode: "per_lb" | "flat" | null
  flatShippingCents: number | null
}

export interface ResolvedZoneSettings {
  currency: string | null
  timezone: string | null
  taxRate: number | null
  shippingRateCentsPerLb: number | null
  freeShippingThresholdCents: number | null
  shippingMode: "per_lb" | "flat" | null
  flatShippingCents: number | null
}

export interface ZoneFeature {
  id: string
  zoneId: string
  featureKey: string
  enabled: boolean
}

export interface ResolvedZone {
  zone: ServiceZone
  ancestors: ServiceZone[]
  effectiveFeatures: Record<string, boolean>
  effectiveSettings: ResolvedZoneSettings
  status: string
  surfacedStatus?: string
}

interface RawServiceZone {
  id: string
  parent_zone_id: string | null
  code: string
  display_name: string
  country_code: string
  subdivision_code: string | null
  postal_pattern: string | null
  status: "enabled" | "coming_soon" | "disabled"
  sort_order: number
  level?: ZoneLevel
  city_name?: string | null
  currency?: string | null
  timezone?: string | null
  tax_rate?: number | null
  shipping_rate_cents_per_lb?: number | null
  free_shipping_threshold_cents?: number | null
  shipping_mode?: "per_lb" | "flat" | null
  flat_shipping_cents?: number | null
}

interface RawResolvedSettings {
  currency?: string | null
  timezone?: string | null
  tax_rate?: number | null
  shipping_rate_cents_per_lb?: number | null
  free_shipping_threshold_cents?: number | null
  shipping_mode?: "per_lb" | "flat" | null
  flat_shipping_cents?: number | null
}

interface RawZoneFeature {
  id: string
  zone_id: string
  feature_key: string
  enabled: boolean
}

function mapZone(z: RawServiceZone): ServiceZone {
  return {
    id: z.id,
    parentZoneId: z.parent_zone_id,
    code: z.code,
    displayName: z.display_name,
    countryCode: z.country_code,
    subdivisionCode: z.subdivision_code,
    postalPattern: z.postal_pattern,
    status: z.status,
    sortOrder: z.sort_order,
    level: z.level ?? "country",
    cityName: z.city_name ?? null,
    currency: z.currency ?? null,
    timezone: z.timezone ?? null,
    taxRate: z.tax_rate ?? null,
    shippingRateCentsPerLb: z.shipping_rate_cents_per_lb ?? null,
    freeShippingThresholdCents: z.free_shipping_threshold_cents ?? null,
    shippingMode: z.shipping_mode ?? null,
    flatShippingCents: z.flat_shipping_cents ?? null,
  }
}

function mapSettings(s: RawResolvedSettings | null | undefined): ResolvedZoneSettings {
  return {
    currency: s?.currency ?? null,
    timezone: s?.timezone ?? null,
    taxRate: s?.tax_rate ?? null,
    shippingRateCentsPerLb: s?.shipping_rate_cents_per_lb ?? null,
    freeShippingThresholdCents: s?.free_shipping_threshold_cents ?? null,
    shippingMode: s?.shipping_mode ?? null,
    flatShippingCents: s?.flat_shipping_cents ?? null,
  }
}

function mapZoneFeature(f: RawZoneFeature): ZoneFeature {
  return {
    id: f.id,
    zoneId: f.zone_id,
    featureKey: f.feature_key,
    enabled: f.enabled,
  }
}

export interface ZoneInput {
  parent_zone_id?: string | null
  code: string
  display_name: string
  country_code: string
  subdivision_code?: string | null
  postal_pattern?: string | null
  status?: "enabled" | "coming_soon" | "disabled"
  sort_order?: number
  level?: ZoneLevel
  city_name?: string | null
  currency?: string | null
  timezone?: string | null
  tax_rate?: number | null
  shipping_rate_cents_per_lb?: number | null
  free_shipping_threshold_cents?: number | null
  shipping_mode?: "per_lb" | "flat" | null
  flat_shipping_cents?: number | null
}

// Public list of Service Zones. The `level` filter narrows to a single tier
// (e.g. "country") and is served from the cacheable public endpoint added in
// Pass 3 of the regions→service_zones migration. Used by seller-facing UIs
// that previously called getRegions() to populate a country picker.
export async function getCountryZones(): Promise<ServiceZone[]> {
  const res = await api<{ zones: RawServiceZone[] | null }>(
    "/api/v1/zones?level=country",
  )
  return (res.zones ?? []).map(mapZone)
}

export async function listAdminZones(token: string): Promise<ServiceZone[]> {
  const res = await api<{ zones: RawServiceZone[] }>("/api/v1/admin/zones", { token })
  return (res.zones ?? []).map(mapZone)
}

export async function createAdminZone(token: string, data: ZoneInput): Promise<ServiceZone> {
  const raw = await api<RawServiceZone>("/api/v1/admin/zones", { method: "POST", body: data, token })
  return mapZone(raw)
}

export async function updateAdminZone(
  token: string,
  id: string,
  data: Partial<ZoneInput>,
): Promise<ServiceZone> {
  const raw = await api<RawServiceZone>(`/api/v1/admin/zones/${id}`, { method: "PUT", body: data, token })
  return mapZone(raw)
}

export function deleteAdminZone(token: string, id: string): Promise<void> {
  return api<void>(`/api/v1/admin/zones/${id}`, { method: "DELETE", token })
}

export async function listZoneFeatures(token: string, zoneId: string): Promise<ZoneFeature[]> {
  const res = await api<{ zone_id: string; features: RawZoneFeature[] | null }>(
    `/api/v1/admin/zones/${zoneId}/features`,
    { token },
  )
  return (res.features ?? []).map(mapZoneFeature)
}

export async function upsertZoneFeature(
  token: string,
  zoneId: string,
  featureKey: string,
  enabled: boolean,
): Promise<void> {
  await api<{ status: string }>(`/api/v1/admin/zones/${zoneId}/features`, {
    method: "POST",
    body: { feature_key: featureKey, enabled },
    token,
  })
}

// Platform-wide feature flags. Global on/off — no location scope.
export interface PlatformFeature {
  featureKey: string
  enabled: boolean
}

export async function listPlatformFeatures(token: string): Promise<PlatformFeature[]> {
  const raw = await api<{ feature_key: string; enabled: boolean }[]>(
    `/api/v1/admin/settings/platform-features`,
    { token },
  )
  return (raw ?? []).map((f) => ({ featureKey: f.feature_key, enabled: f.enabled }))
}

export async function upsertPlatformFeature(
  token: string,
  featureKey: string,
  enabled: boolean,
): Promise<void> {
  await api<{ feature_key: string; enabled: boolean }>(
    `/api/v1/admin/settings/platform-features`,
    { method: "PUT", body: { feature_key: featureKey, enabled }, token },
  )
}

// Public feature catalog — same shape across envs. Used by the admin UI to
// render the feature dropdown without a hardcoded list drifting from the
// server. The static FEATURE_CATALOG in lib/feature-catalog.ts is the
// synchronous fallback.
export async function getFeatureCatalog(): Promise<
  import("./feature-catalog").FeatureCatalogEntry[]
> {
  return api<import("./feature-catalog").FeatureCatalogEntry[]>(
    `/api/v1/zones/feature-catalog`,
  )
}

// Public resolver used by the storefront once a buyer location is known.
// Returns null when no zone matches the country (silently fall through).
export async function resolveServiceZone(
  country: string,
  subdivision?: string | null,
  postal?: string | null,
  city?: string | null,
): Promise<ResolvedZone | null> {
  const params = new URLSearchParams({ country })
  if (subdivision) params.set("subdivision", subdivision)
  if (postal) params.set("postal", postal)
  if (city) params.set("city", city)
  try {
    const raw = await api<{
      zone: RawServiceZone
      ancestors: RawServiceZone[] | null
      effective_features: Record<string, boolean> | null
      effective_settings: RawResolvedSettings | null
      status: string
      surfaced_status?: string
    }>(`/api/v1/zones/resolve?${params.toString()}`)
    return {
      zone: mapZone(raw.zone),
      ancestors: (raw.ancestors ?? []).map(mapZone),
      effectiveFeatures: raw.effective_features ?? {},
      effectiveSettings: mapSettings(raw.effective_settings),
      status: raw.status,
      surfacedStatus: raw.surfaced_status,
    }
  } catch {
    return null
  }
}

// ── Marketplace config ──────────────────────────────────────────────────────
// Feature flags previously lived here as a regional CRUD; they now live as
// build-time NEXT_PUBLIC_FEATURE_* env vars via lib/features.ts. The handful
// of flags that ever flipped were buyer-side kill-switches that don't
// justify a backend table.

export interface MarketplaceConfig {
  maxProductImages: number
  maxProductTags: number
}

/**
 * Marketplace caps. Previously embedded in the marketplace_enabled feature
 * flag's config blob; now hardcoded defaults until we have a real reason to
 * make these region-aware. Kept as a function so callers don't shift.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getMarketplaceConfig(_regionId: string): Promise<MarketplaceConfig> {
  return { maxProductImages: 4, maxProductTags: 5 }
}

// ── Public: Shipping eligibility ──────────────────────────────────────────

export interface ShippingEligibility {
  result: "eligible" | "not_eligible" | "unknown"
  reason?: string
  distanceMeters?: number
}

export async function checkShippingEligibility(args: {
  storeId: string
  lat?: number | null
  lng?: number | null
  country?: string
  state?: string | null
  postalCode?: string
}): Promise<ShippingEligibility> {
  const params = new URLSearchParams({ storeId: args.storeId })
  if (args.lat != null) params.set("lat", String(args.lat))
  if (args.lng != null) params.set("lng", String(args.lng))
  if (args.country) params.set("country", args.country)
  if (args.state) params.set("state", args.state)
  if (args.postalCode) params.set("postalCode", args.postalCode)
  return api<ShippingEligibility>(`/api/v1/sellers/public/shipping/eligibility?${params}`)
}

// Geocoding moved fully client-side (DeliverToPicker calls Google Maps
// directly with NEXT_PUBLIC_GOOGLE_MAPS_API_KEY and falls back to
// BigDataCloud / Zippopotam.us). The seller-side endpoints that used
// to live here were removed.

// ── Public: Seller marketing stats ────────────────────────────────────────

export interface PublicSellerStats {
  activeSellers: number
}

export async function getPublicSellerStats(opts?: { revalidate?: number }): Promise<PublicSellerStats> {
  return api<PublicSellerStats>("/api/v1/sellers/public/stats", {
    next: opts?.revalidate ? { revalidate: opts.revalidate } : undefined,
  })
}

// ── Public: Region Config (features & payments) ──

export interface RegionPaymentMethod {
  id: string
  regionId: string
  provider: string
  enabled: boolean
  providerConfig: Record<string, unknown> | null
}

export interface RegionConfig {
  region: Region
  features: Record<string, boolean>
  featureConfigs?: Record<string, unknown>
  paymentMethods: RegionPaymentMethod[]
}

interface RawRegionPaymentMethod {
  id: string
  region_id: string
  provider: string
  enabled: boolean
  provider_config?: unknown
}

interface RawRegionConfigPayload {
  region: RawRegion
  features: Record<string, boolean>
  feature_configs?: Record<string, unknown>
  payment_methods?: RawRegionPaymentMethod[]
}

function mapRegionPaymentMethod(m: RawRegionPaymentMethod): RegionPaymentMethod {
  const cfg = m.provider_config
  return {
    id: m.id,
    regionId: m.region_id,
    provider: m.provider,
    enabled: m.enabled,
    providerConfig: cfg && typeof cfg === "object" ? (cfg as Record<string, unknown>) : null,
  }
}

/** Maps config-service JSON (snake_case) to app types. */
export async function getRegionConfig(regionCode: string): Promise<RegionConfig> {
  const raw = await api<RawRegionConfigPayload>(`/api/v1/config/${regionCode}`)
  return {
    region: mapRegion(raw.region),
    features: raw.features ?? {},
    featureConfigs: raw.feature_configs,
    paymentMethods: (raw.payment_methods ?? []).map(mapRegionPaymentMethod),
  }
}

// ── Admin: Products ──

export function getAdminProducts(token: string, status?: string, page = 0, size = 20) {
  const params = new URLSearchParams({ page: String(page), size: String(size), sort: "createdAt,desc" })
  if (status && status !== "all") params.set("status", status)
  return api<Page<Product>>(`/api/v1/products/admin/all?${params}`, { token })
}

export function approveProduct(token: string, productId: string) {
  return api<void>(`/api/v1/products/${productId}/approve`, { method: "PUT", token })
}


export function rejectProduct(token: string, productId: string, reason: string) {
  return api<void>(`/api/v1/products/${productId}/reject`, { method: "PUT", body: { reason }, token })
}

// ── Admin: Sellers ──

export function getAdminSellers(token: string, status?: string, page = 0, size = 20, onboardingStatus?: string, atRisk?: boolean) {
  let qs = `?page=${page}&size=${size}`
  if (status) qs += `&status=${status}`
  if (onboardingStatus) qs += `&onboardingStatus=${onboardingStatus}`
  if (atRisk) qs += `&at_risk=true`
  return api<Page<SellerInfo>>(`/api/v1/admin/sellers${qs}`, { token })
}

export function getSellerLifecycleSummary(token: string) {
  return api<Record<string, number>>(`/api/v1/admin/sellers/lifecycle-summary`, { token })
}

export function nudgeSellerLifecycle(token: string, sellerId: string) {
  return api<{ ok: boolean; stage?: string; reason?: string }>(
    `/api/v1/admin/sellers/${encodeURIComponent(sellerId)}/lifecycle-nudge`,
    { method: "POST", token },
  )
}

export function approveSeller(token: string, id: string) {
  return api<SellerInfo>(`/api/v1/admin/sellers/${id}/approve`, { method: "POST", token })
}

export function suspendSeller(token: string, id: string, reason: string) {
  return api<SellerInfo>(`/api/v1/admin/sellers/${id}/suspend`, {
    method: "POST",
    token,
    body: { reason },
  })
}

export function reinstateSeller(token: string, id: string) {
  return api<SellerInfo>(`/api/v1/admin/sellers/${id}/reinstate`, {
    method: "POST",
    token,
  })
}

/**
 * Pull the seller's live Connect Account from Stripe and re-run the same
 * lifecycle handler the account.updated webhook uses. Use this when a
 * webhook never delivered (misconfigured endpoint, signing-secret mismatch,
 * etc.) and the admin UI is showing stale data.
 */
export function refreshSellerStripe(token: string, id: string) {
  return api<AdminSellerDetail>(`/api/v1/admin/sellers/${id}/refresh-stripe`, {
    method: "POST",
    token,
  })
}

/** Toggle the test_account flag. Test accounts are skipped by the
 *  subscription billing scheduler — used for team demo / smoke-test
 *  sellers in prod that should never see a charge. */
export function setSellerTestAccount(token: string, id: string, enabled: boolean) {
  return api<SellerInfo>(`/api/v1/admin/sellers/${id}/test-account`, {
    method: "POST",
    token,
    body: { enabled },
  })
}

export function triggerOnboardingReminders(token: string) {
  return api<{ triggered: number }>(`/api/v1/admin/sellers/onboarding-reminders/trigger`, { method: "POST", token })
}

export function sendSellerReminder(token: string, sellerId: string) {
  return api<{ status: string }>(`/api/v1/admin/sellers/${sellerId}/send-reminder`, { method: "POST", token })
}

// ── User Profile ──

export interface UserProfile {
  id: string
  keycloakId: string
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  avatarUrl: string | null
  role: string
  preferences: string | null
  /** Stripe PaymentMethod id (pm_...) the buyer flagged as their default in
   *  Account → Payment Methods. Used by the 1-click reorder fast-path. */
  defaultPaymentMethodId?: string | null
  createdAt: string
}

export function getUserProfile(token: string) {
  return api<UserProfile>("/api/v1/users/me", { token })
}

export function getUserProfileById(token: string, id: string) {
  return api<UserProfile>(`/api/v1/users/${id}`, { token })
}

export function updateUserProfile(token: string, data: Record<string, unknown>) {
  return api<UserProfile>("/api/v1/users/me", { method: "PUT", body: data, token })
}

/**
 * Update buyer-facing defaults — currently just the default saved card.
 * Pass empty string for `defaultPaymentMethodId` to clear the default.
 * Default address lives on the address row (is_default) and is flipped via
 * {@link setDefaultAddress}.
 */
export function updateUserDefaults(
  token: string,
  data: { defaultPaymentMethodId?: string | null },
) {
  return api<UserProfile>("/api/v1/users/me/defaults", { method: "PATCH", body: data, token })
}

// ── Addresses ──

export interface UserAddress {
  id: string
  label: string
  line1: string
  line2: string | null
  city: string
  state: string
  postalCode: string
  countryCode: string
  isDefault: boolean
  phone?: string | null
  createdAt: string
  updatedAt: string
}

export function getAddresses(token: string) {
  return api<UserAddress[]>("/api/v1/users/me/addresses", { token })
}

export interface CheckoutShippingContext {
  profile: UserProfile
  addresses: UserAddress[]
  addressesUnavailable: boolean
}

/**
 * Token-scoped in-flight cache for the checkout shipping context.
 *
 * The cart page calls `prefetchCheckoutShippingContext(token)` on hover /
 * pointer-down of the "Proceed to Checkout" button; the checkout page's
 * `loadCheckoutShippingContext` then joins the same in-flight promise
 * instead of firing a fresh round-trip after mount. Short TTL because
 * tokens rotate and we don't want to serve addresses from a stale session.
 */
const CHECKOUT_CTX_TTL_MS = 30_000
const checkoutCtxCache = new Map<string, { at: number; promise: Promise<CheckoutShippingContext> }>()

function fetchCheckoutShippingContext(token: string): Promise<CheckoutShippingContext> {
  return (async () => {
    const [profileResult, addressesResult] = await Promise.allSettled([
      getUserProfile(token),
      getAddresses(token),
    ])

    if (profileResult.status === "rejected") {
      throw profileResult.reason
    }
    const profile = profileResult.value

    let addresses: UserAddress[] = []
    let addressesUnavailable = false
    if (addressesResult.status === "fulfilled") {
      addresses = addressesResult.value
    } else {
      const e = addressesResult.reason
      if (e instanceof ApiError && (e.status === 404 || e.status === 502 || e.status === 503)) {
        addressesUnavailable = true
      } else {
        throw e
      }
    }
    return { profile, addresses, addressesUnavailable }
  })()
}

/** Fire-and-forget: warm the checkout context cache before navigation. */
export function prefetchCheckoutShippingContext(token: string): void {
  if (!token) return
  const hit = checkoutCtxCache.get(token)
  if (hit && Date.now() - hit.at < CHECKOUT_CTX_TTL_MS) return
  const promise = fetchCheckoutShippingContext(token).catch((e) => {
    checkoutCtxCache.delete(token)
    throw e
  })
  checkoutCtxCache.set(token, { at: Date.now(), promise })
}

/**
 * Checkout: loads buyer profile and saved addresses in parallel, reusing the
 * warm cache from `prefetchCheckoutShippingContext` when available.
 *
 * If the address list endpoint fails (routing/outage), `addresses` is empty
 * and `addressesUnavailable` is true.
 */
export async function loadCheckoutShippingContext(token: string): Promise<CheckoutShippingContext> {
  const hit = checkoutCtxCache.get(token)
  if (hit && Date.now() - hit.at < CHECKOUT_CTX_TTL_MS) {
    return hit.promise
  }
  const promise = fetchCheckoutShippingContext(token)
  checkoutCtxCache.set(token, { at: Date.now(), promise })
  try {
    return await promise
  } catch (e) {
    checkoutCtxCache.delete(token)
    throw e
  }
}

/**
 * Drop the cached checkout shipping context so the next load refetches. MUST be
 * called after any address mutation — otherwise the 30s cache keeps serving a
 * stale list (a deleted address reappears and gets submitted as the shipping
 * address id, producing a 404 at checkout).
 */
export function invalidateCheckoutShippingContext(token: string) {
  checkoutCtxCache.delete(token)
}

export async function createAddress(token: string, data: {
  label?: string; line1: string; line2?: string; city: string; state: string; postalCode: string; countryCode: string; isDefault?: boolean
}) {
  try {
    return await api<UserAddress>("/api/v1/users/me/addresses", { method: "POST", body: data, token })
  } finally {
    invalidateCheckoutShippingContext(token)
  }
}

export async function updateAddress(token: string, id: string, data: Record<string, unknown>) {
  try {
    return await api<UserAddress>(`/api/v1/users/me/addresses/${id}`, { method: "PUT", body: data, token })
  } finally {
    invalidateCheckoutShippingContext(token)
  }
}

export async function deleteAddress(token: string, id: string) {
  try {
    return await api<void>(`/api/v1/users/me/addresses/${id}`, { method: "DELETE", token })
  } finally {
    // Clear even on 404 (already gone) — the cached list is stale either way.
    invalidateCheckoutShippingContext(token)
  }
}

export async function setDefaultAddress(token: string, id: string) {
  try {
    return await api<UserAddress>(`/api/v1/users/me/addresses/${id}/default`, { method: "PUT", token })
  } finally {
    invalidateCheckoutShippingContext(token)
  }
}

// ── Media ──

export interface MediaItem {
  id: string
  seller_id: string
  name: string
  description: string
  url: string
  file_key: string
  content_type: string
  size_bytes: number
  created_at: string
  updated_at: string
}

export interface MediaListResponse {
  items: MediaItem[]
  total_count: number
  page: number
  page_size: number
}

export function getSellerMedia(token: string, page = 1, pageSize = 50) {
  return api<MediaListResponse>(`/api/v1/media?page=${page}&page_size=${pageSize}`, { token })
}

export function createMediaItem(
  token: string,
  data: { name: string; description?: string; url: string; file_key?: string; content_type?: string; size_bytes?: number },
) {
  return api<MediaItem>("/api/v1/media", { method: "POST", body: data, token })
}

export function updateMediaItem(token: string, id: string, data: { name?: string; description?: string }) {
  return api<MediaItem>(`/api/v1/media/${id}`, { method: "PUT", body: data, token })
}

export function deleteMediaItem(token: string, id: string) {
  return api<{ id: string; file_key: string; status: string }>(`/api/v1/media/${id}`, { method: "DELETE", token })
}

// ── Seller Payouts ──

export interface PayoutSummary {
  totalEarningsCents: number
  pendingSettlementCents: number
  readyForTransferCents: number
  transferredCents: number
  currency: string
}

export interface TransferRecord {
  id: string
  storeId: string
  orderId: string
  amountCents: number
  subtotalCents: number
  platformFeeCents: number
  shippingCents: number
  taxCents: number
  stripeFeeCents: number
  discountCents: number
  couponCode: string | null
  couponType: string | null
  status: string
  stripeTransferId: string | null
  estimatedSettlementAt: string | null
  settledAt: string | null
  transferredAt: string | null
  createdAt: string
}

export function getPayoutSummary(token: string, storeId: string) {
  return api<PayoutSummary>(`/api/v1/payouts/store/${storeId}/summary`, { token })
}

export function getPayouts(token: string, storeId: string, page = 0, size = 20, status?: string) {
  const params = new URLSearchParams({ page: String(page), size: String(size), sort: "createdAt,desc" })
  if (status) params.set("status", status)
  return api<Page<TransferRecord>>(`/api/v1/payouts/store/${storeId}?${params}`, { token })
}

export interface AdminPayoutSummary {
  pendingSettlementCents: number
  readyForTransferCents: number
  transferredCents: number
  failedCents: number
  totalCents: number
}

export function getAdminPayoutSummary(token: string) {
  return api<AdminPayoutSummary>("/api/v1/admin/payouts/summary", { token })
}

export function getAdminPayouts(token: string, page = 0, size = 20, status?: string) {
  const params = new URLSearchParams({ page: String(page), size: String(size), sort: "createdAt,desc" })
  if (status) params.set("status", status)
  return api<Page<TransferRecord>>(`/api/v1/admin/payouts?${params}`, { token })
}

// ── Email Templates (Admin) ──────────────────────────────────────────────────

export interface VariableDef {
  name: string
  description: string
  required: boolean
  sample_value: string
}

export interface EmailTemplate {
  id: string
  slug: string
  name: string
  description: string
  category: string
  subject_template: string
  html_body: string
  text_body: string
  variables: VariableDef[]
  use_layout: boolean
  is_default: boolean
  version: number
  updated_by: string
  // Free-form plain text the admin leaves for developers describing the
  // verbiage/copy they want — never rendered into the email itself.
  admin_notes?: string
  created_at: string
  updated_at: string
  sample_data?: Record<string, unknown>
}

export function getEmailTemplates(token: string, category?: string) {
  const params = category ? `?category=${category}` : ""
  return api<EmailTemplate[]>(`/api/admin/email-templates${params}`, { token })
}

export function getEmailTemplate(token: string, slug: string) {
  return api<EmailTemplate & { sample_data: Record<string, unknown> }>(`/api/admin/email-templates/${slug}`, { token })
}

export function updateEmailTemplate(
  token: string,
  slug: string,
  body: { subject_template: string; html_body: string; text_body: string; admin_notes?: string },
) {
  return api<EmailTemplate>(`/api/admin/email-templates/${slug}`, { method: "PUT", token, body })
}

export function previewEmailTemplate(token: string, slug: string, body: { html_body?: string; data?: Record<string, unknown> }) {
  return fetch(`${API_BASE}/api/admin/email-templates/${slug}/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }).then(r => r.text())
}

export function resetEmailTemplate(token: string, slug: string) {
  return api<EmailTemplate>(`/api/admin/email-templates/${slug}/reset`, { method: "POST", token })
}

export function createEmailTemplate(token: string, body: {
  slug: string; name: string; description: string; category: string;
  subject_template: string; html_body: string; text_body: string;
  variables: VariableDef[]; use_layout: boolean; admin_notes?: string;
}) {
  return api<EmailTemplate>(`/api/admin/email-templates`, { method: "POST", token, body })
}

export function deleteEmailTemplate(token: string, slug: string) {
  return fetch(`${API_BASE}/api/admin/email-templates/${slug}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function sendTestEmail(token: string, slug: string, body: { to: string; data?: Record<string, unknown> }) {
  return api<{ status: string; to: string; subject: string }>(`/api/admin/email-templates/${slug}/send-test`, { method: "POST", token, body })
}

export function previewRawTemplate(token: string, body: { html_body: string; use_layout: boolean; variables?: VariableDef[]; data?: Record<string, unknown> }) {
  return fetch(`${API_BASE}/api/admin/email-templates/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }).then(r => r.text())
}

// ── Notification Recipients (Admin) ─────────────────────────────────────────

export interface NotificationRecipient {
  id: string
  event_type: string
  email: string
  label: string
  active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface EventTypeInfo {
  key: string
  label: string
  description: string
}

export function getNotificationRecipients(token: string, eventType?: string) {
  const params = eventType ? `?event_type=${eventType}` : ""
  return api<NotificationRecipient[]>(`/api/admin/notification-recipients${params}`, { token })
}

export function getEventTypes(token: string) {
  return api<EventTypeInfo[]>(`/api/admin/notification-recipients/event-types`, { token })
}

export function addNotificationRecipient(token: string, body: { event_type: string; email: string; label: string }) {
  return api<NotificationRecipient>(`/api/admin/notification-recipients`, { method: "POST", token, body })
}

export function removeNotificationRecipient(token: string, id: string) {
  return fetch(`${API_BASE}/api/admin/notification-recipients/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function toggleNotificationRecipient(token: string, id: string, active: boolean) {
  return api<NotificationRecipient>(`/api/admin/notification-recipients/${id}/toggle`, { method: "PATCH", token, body: { active } })
}

// ── Deals ──

export interface DealData {
  id: string
  storeId: string
  sellerId: string
  productId: string | null
  title: string
  description: string | null
  badgeText: string | null
  discountPercent: number | null
  dealPriceCents: number | null
  originalPriceCents: number | null
  enabled: boolean
  active: boolean
  startAt: string | null
  endAt: string | null
  createdAt: string
  productTitle: string | null
  productSlug: string | null
  productImageUrl: string | null
  storeName: string | null
  couponCode?: string
  /** Slugs of the linked product's categories — populated by the backend
      enrichWithProduct step so /deals can filter by department. */
  categorySlugs?: string[] | null
  /** Denormalized review aggregate from the linked product. Populated by
      enrichWithProduct so the Customer Rating filter doesn't need a separate
      fan-out fetch. */
  avgRating?: number | null
  reviewCount?: number | null
  /** Whether the linked product has any sellable stock. Populated by
      enrichWithProduct so deal cards can gate Add-to-Cart. Undefined when the
      deal has no linked product — treat undefined as out of stock. */
  inStock?: boolean | null
}

export interface PlatformDealDto {
  id: string
  title: string
  description: string
  discountPercent?: number
  dealPriceCents?: number
  startAt?: string
  endAt?: string
}

export interface UnifiedDealsResponse {
  marketplaceDeals: DealData[]
  platformDeals: PlatformDealDto[]
}

export interface DealCreateRequest {
  storeId?: string
  productId?: string
  title: string
  description?: string
  badgeText?: string
  discountPercent?: number
  dealPriceCents?: number
  startAt?: string
  endAt?: string
}

export async function getActiveDeals(): Promise<DealData[]> {
  const res = await api<UnifiedDealsResponse>("/api/v1/deals")
  return res.marketplaceDeals || []
}

export function getFeaturedDeals(opts?: { revalidate?: number }) {
  return api<DealData[]>("/api/v1/deals/featured", {
    next: opts?.revalidate !== undefined ? { revalidate: opts.revalidate, tags: ["deals"] } : undefined,
  })
}

export function getSellerDeals(token: string, page = 0, size = 20) {
  return api<Page<DealData>>(`/api/v1/seller/deals?page=${page}&size=${size}`, { token })
}

export function createSellerDeal(token: string, data: DealCreateRequest) {
  return api<DealData>("/api/v1/seller/deals", { method: "POST", body: data, token })
}

export function updateSellerDeal(token: string, id: string, data: Partial<DealCreateRequest>) {
  return api<DealData>(`/api/v1/seller/deals/${id}`, { method: "PUT", body: data, token })
}

export function deleteSellerDeal(token: string, id: string) {
  return api<void>(`/api/v1/seller/deals/${id}`, { method: "DELETE", token })
}

export function toggleSellerDeal(token: string, id: string) {
  return api<DealData>(`/api/v1/seller/deals/${id}/toggle`, { method: "POST", token })
}

// ── Platform Deals (Admin) ──

export interface PlatformDealData {
  id: string
  title: string
  description: string | null
  content: string | null
  badgeText: string | null
  bannerImageUrl: string | null
  primaryColor: string
  secondaryColor: string
  textColor: string
  ctaText: string | null
  ctaLink: string | null
  targetAudience: string
  enabled: boolean
  active: boolean
  startAt: string | null
  endAt: string | null
  sortOrder: number
  createdAt: string
}

export interface PlatformDealCreateRequest {
  title: string
  description?: string
  content?: string
  badgeText?: string
  bannerImageUrl?: string
  primaryColor?: string
  secondaryColor?: string
  textColor?: string
  ctaText?: string
  ctaLink?: string
  targetAudience?: string
  startAt?: string
  endAt?: string
  sortOrder?: number
}

export function getAdminPlatformDeals(token: string, page = 0, size = 50) {
  return api<Page<PlatformDealData>>(`/api/v1/admin/platform-deals?page=${page}&size=${size}`, { token })
}

export function createPlatformDeal(token: string, data: PlatformDealCreateRequest) {
  return api<PlatformDealData>("/api/v1/admin/platform-deals", { method: "POST", body: data, token })
}

export function updatePlatformDeal(token: string, id: string, data: Partial<PlatformDealCreateRequest>) {
  return api<PlatformDealData>(`/api/v1/admin/platform-deals/${id}`, { method: "PUT", body: data, token })
}

export function deletePlatformDeal(token: string, id: string) {
  return api<void>(`/api/v1/admin/platform-deals/${id}`, { method: "DELETE", token })
}

export function togglePlatformDeal(token: string, id: string) {
  return api<PlatformDealData>(`/api/v1/admin/platform-deals/${id}/toggle`, { method: "POST", token })
}

export function getPublicPlatformDeals(audience?: string, opts?: { revalidate?: number }) {
  const q = audience ? `?audience=${audience}` : ""
  return api<PlatformDealData[]>(`/api/v1/platform-deals${q}`, {
    next: opts?.revalidate !== undefined ? { revalidate: opts.revalidate, tags: ["platform-deals"] } : undefined,
  })
}

// ── Search / Elasticsearch ───────────────────────────────────────────────────

/**
 * Triggers a full reindex of all active products from the product catalog
 * into Elasticsearch.  Admin-only endpoint.
 */
export function triggerSearchReindex(token: string) {
  return api<{ message: string; indexed: number }>("/api/v1/search/reindex", {
    method: "POST",
    token,
  })
}

export function triggerSearchPurge(token: string) {
  return api<{ message: string; deleted: number }>("/api/v1/search/purge", {
    method: "POST",
    token,
  })
}

// ── Analytics ────────────────────────────────────────────────────────────────

export interface AdminAnalyticsDailyPoint {
  day: string
  revenueCents: number
  commissionCents: number
  orderCount: number
}

export interface AdminAnalyticsStatusCount {
  status: string
  count: number
  revenueCents: number
}

export interface AdminAnalyticsRegionRevenue {
  regionId: string
  /** Resolved from config.regions when available */
  regionName?: string
  revenueCents: number
  orderCount: number
}

export interface AdminAnalyticsStoreRevenue {
  storeId: string
  /** Resolved from seller.stores when available */
  storeName?: string
  revenueCents: number
  orderCount: number
}

export interface AdminAnalyticsPlatformHealth {
  totalSellers: number
  approvedSellers: number
  pendingSellerApplications: number
  activeStores: number
  totalProducts: number
  activeProducts: number
  draftProducts: number
  storesWithActiveCatalog: number
  successfulPayments: number
  failedPayments: number
  pendingTransfers: number
  pendingTransferAmountCents: number
  paidTransferAmountCents: number
  totalReviews?: number
  avgRating?: number
  reviewsLast30Days?: number
  totalRecipients?: number
  activeRecipients?: number
  templateCount?: number
}

export interface AdminAnalyticsResponse {
  totalRevenueCents: number
  totalCommissionCents: number
  totalOrders: number
  avgOrderValueCents: number
  totalDiscountCents: number
  allOrdersCreatedCount: number
  cancelledOrderCount: number
  paymentFailedOrderCount: number
  cancelledOrderPercent: number
  paymentFailedOrderPercent: number
  revenueByDay: AdminAnalyticsDailyPoint[]
  ordersByStatus: AdminAnalyticsStatusCount[]
  revenueByRegion: AdminAnalyticsRegionRevenue[]
  topStores: AdminAnalyticsStoreRevenue[]
  platformHealth?: AdminAnalyticsPlatformHealth
}
export interface SellerAnalyticsDailyPoint {
  day: string
  revenueCents: number
  orderCount: number
}

export interface SellerAnalyticsStatusCount {
  status: string
  count: number
}

export interface SellerAnalyticsProductRevenue {
  productId: string
  productTitle: string
  revenueCents: number
  unitsSold: number
  orderCount: number
}

export interface SellerAnalyticsResponse {
  totalRevenueCents: number
  totalOrders: number
  avgOrderValueCents: number
  fulfillmentRate: number
  revenueByDay: SellerAnalyticsDailyPoint[]
  fulfillmentByStatus: SellerAnalyticsStatusCount[]
  topProducts: SellerAnalyticsProductRevenue[]
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function pickNum(o: Record<string, unknown>, camel: string, snake: string): number {
  const v = o[camel] ?? o[snake]
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v)
  return 0
}

function pickStr(o: Record<string, unknown>, camel: string, snake: string): string {
  const v = o[camel] ?? o[snake]
  if (typeof v === "string") return v
  if (v != null && typeof v !== "object") return String(v)
  return ""
}

function pickArr(o: Record<string, unknown>, camel: string, snake: string): unknown[] {
  const a = o[camel] ?? o[snake]
  return Array.isArray(a) ? a : []
}

function normalizeAdminAnalytics(raw: unknown): AdminAnalyticsResponse {
  const o = asRecord(raw) ?? {}
  const mapDay = (row: unknown): AdminAnalyticsDailyPoint => {
    const r = asRecord(row) ?? {}
    return {
      day: pickStr(r, "day", "day"),
      revenueCents: pickNum(r, "revenueCents", "revenue_cents"),
      commissionCents: pickNum(r, "commissionCents", "commission_cents"),
      orderCount: pickNum(r, "orderCount", "order_count"),
    }
  }
  const mapStatus = (row: unknown): AdminAnalyticsStatusCount => {
    const r = asRecord(row) ?? {}
    return {
      status: pickStr(r, "status", "status"),
      count: pickNum(r, "count", "count"),
      revenueCents: pickNum(r, "revenueCents", "revenue_cents"),
    }
  }
  const mapRegion = (row: unknown): AdminAnalyticsRegionRevenue => {
    const r = asRecord(row) ?? {}
    const regionName =
      pickStr(r, "regionName", "region_name") ||
      pickStr(r, "regionLabel", "region_label")
    return {
      regionId: pickStr(r, "regionId", "region_id"),
      regionName: regionName || undefined,
      revenueCents: pickNum(r, "revenueCents", "revenue_cents"),
      orderCount: pickNum(r, "orderCount", "order_count"),
    }
  }
  const mapStore = (row: unknown): AdminAnalyticsStoreRevenue => {
    const r = asRecord(row) ?? {}
    const storeName =
      pickStr(r, "storeName", "store_name") ||
      pickStr(r, "storeLabel", "store_label")
    return {
      storeId: pickStr(r, "storeId", "store_id"),
      storeName: storeName || undefined,
      revenueCents: pickNum(r, "revenueCents", "revenue_cents"),
      orderCount: pickNum(r, "orderCount", "order_count"),
    }
  }
  const rawPlatformHealth = o.platformHealth ?? o.platform_health

  const out: AdminAnalyticsResponse = {
    totalRevenueCents: pickNum(o, "totalRevenueCents", "total_revenue_cents"),
    totalCommissionCents: pickNum(o, "totalCommissionCents", "total_commission_cents"),
    totalOrders: pickNum(o, "totalOrders", "total_orders"),
    avgOrderValueCents: pickNum(o, "avgOrderValueCents", "avg_order_value_cents"),
    totalDiscountCents: pickNum(o, "totalDiscountCents", "total_discount_cents"),
    allOrdersCreatedCount: pickNum(o, "allOrdersCreatedCount", "all_orders_created_count"),
    cancelledOrderCount: pickNum(o, "cancelledOrderCount", "cancelled_order_count"),
    paymentFailedOrderCount: pickNum(o, "paymentFailedOrderCount", "payment_failed_order_count"),
    cancelledOrderPercent: pickNum(o, "cancelledOrderPercent", "cancelled_order_percent"),
    paymentFailedOrderPercent: pickNum(o, "paymentFailedOrderPercent", "payment_failed_order_percent"),
    revenueByDay: pickArr(o, "revenueByDay", "revenue_by_day").map(mapDay),
    ordersByStatus: pickArr(o, "ordersByStatus", "orders_by_status").map(mapStatus),
    revenueByRegion: pickArr(o, "revenueByRegion", "revenue_by_region").map(mapRegion),
    topStores: pickArr(o, "topStores", "top_stores").map(mapStore),
  }

  if (
    rawPlatformHealth !== null &&
    rawPlatformHealth !== undefined &&
    typeof rawPlatformHealth === "object" &&
    !Array.isArray(rawPlatformHealth)
  ) {
    out.platformHealth = rawPlatformHealth as AdminAnalyticsPlatformHealth
  }

  return out
}

function mapSellerAnalyticsDay(row: unknown): SellerAnalyticsDailyPoint {
  const r = asRecord(row) ?? {}
  return {
    day: pickStr(r, "day", "day"),
    revenueCents: pickNum(r, "revenueCents", "revenue_cents"),
    orderCount: pickNum(r, "orderCount", "order_count"),
  }
}

function mapSellerAnalyticsFulfillment(row: unknown): SellerAnalyticsStatusCount {
  const r = asRecord(row) ?? {}
  return {
    status: pickStr(r, "status", "status"),
    count: pickNum(r, "count", "count"),
  }
}

function mapSellerAnalyticsProduct(row: unknown): SellerAnalyticsProductRevenue {
  const r = asRecord(row) ?? {}
  return {
    productId: pickStr(r, "productId", "product_id"),
    productTitle: pickStr(r, "productTitle", "product_title"),
    revenueCents: pickNum(r, "revenueCents", "revenue_cents"),
    unitsSold: pickNum(r, "unitsSold", "units_sold"),
    orderCount: pickNum(r, "orderCount", "order_count"),
  }
}

function normalizeSellerAnalytics(raw: unknown): SellerAnalyticsResponse {
  const o = asRecord(raw) ?? {}
  return {
    totalRevenueCents: pickNum(o, "totalRevenueCents", "total_revenue_cents"),
    totalOrders: pickNum(o, "totalOrders", "total_orders"),
    avgOrderValueCents: pickNum(o, "avgOrderValueCents", "avg_order_value_cents"),
    fulfillmentRate: pickNum(o, "fulfillmentRate", "fulfillment_rate"),
    revenueByDay: pickArr(o, "revenueByDay", "revenue_by_day").map(mapSellerAnalyticsDay),
    fulfillmentByStatus: pickArr(o, "fulfillmentByStatus", "fulfillment_by_status").map(
      mapSellerAnalyticsFulfillment,
    ),
    topProducts: pickArr(o, "topProducts", "top_products").map(mapSellerAnalyticsProduct),
  }
}

export async function getAdminAnalytics(
  token: string,
  startDate: string,
  endDate: string,
): Promise<AdminAnalyticsResponse> {
  const raw = await api<unknown>(
    `/api/v1/analytics/admin?startDate=${startDate}&endDate=${endDate}`,
    { token },
  )
  return normalizeAdminAnalytics(raw)
}

export interface SellerAnalyticsSnapshot {
  totalSellers: number
  approvedSellers: number
  pendingSellerApplications: number
  activeStores: number
}

export interface CatalogAnalyticsSnapshot {
  totalProducts: number
  activeProducts: number
  draftProducts: number
  storesWithActiveCatalog: number
}

export interface PaymentAnalyticsSnapshot {
  successfulPayments: number
  failedPayments: number
  pendingTransfers: number
  pendingTransferAmountCents: number
  paidTransferAmountCents: number
}

export interface ReviewAnalyticsSnapshot {
  totalReviews: number
  avgRating: number
  verifiedReviews: number
  reviewsLast30Days: number
}

export interface NotificationAnalyticsSnapshot {
  totalRecipients: number
  activeRecipients: number
  templateCount: number
  customTemplateCount: number
}

function normalizeSellerSnapshot(raw: unknown): SellerAnalyticsSnapshot {
  const o = asRecord(raw) ?? {}
  return {
    totalSellers: pickNum(o, "totalSellers", "total_sellers"),
    approvedSellers: pickNum(o, "approvedSellers", "approved_sellers"),
    pendingSellerApplications: pickNum(o, "pendingSellerApplications", "pending_seller_applications"),
    activeStores: pickNum(o, "activeStores", "active_stores"),
  }
}

function normalizeCatalogSnapshot(raw: unknown): CatalogAnalyticsSnapshot {
  const o = asRecord(raw) ?? {}
  return {
    totalProducts: pickNum(o, "totalProducts", "total_products"),
    activeProducts: pickNum(o, "activeProducts", "active_products"),
    draftProducts: pickNum(o, "draftProducts", "draft_products"),
    storesWithActiveCatalog: pickNum(o, "storesWithActiveCatalog", "stores_with_active_catalog"),
  }
}

function normalizePaymentSnapshot(raw: unknown): PaymentAnalyticsSnapshot {
  const o = asRecord(raw) ?? {}
  const pendingSettlementCents = pickNum(o, "pendingSettlementCents", "pending_settlement_cents")
  const readyForTransferCents = pickNum(o, "readyForTransferCents", "ready_for_transfer_cents")
  const transferredCents = pickNum(o, "transferredCents", "transferred_cents")
  const pendingAmountFromSummary = pendingSettlementCents + readyForTransferCents
  const paidAmountFromSummary = transferredCents
  return {
    successfulPayments: pickNum(o, "successfulPayments", "successful_payments"),
    failedPayments: pickNum(o, "failedPayments", "failed_payments"),
    pendingTransfers: pickNum(o, "pendingTransfers", "pending_transfers"),
    pendingTransferAmountCents:
      pickNum(o, "pendingTransferAmountCents", "pending_transfer_amount_cents") || pendingAmountFromSummary,
    paidTransferAmountCents:
      pickNum(o, "paidTransferAmountCents", "paid_transfer_amount_cents") || paidAmountFromSummary,
  }
}

function normalizeReviewSnapshot(raw: unknown): ReviewAnalyticsSnapshot {
  const o = asRecord(raw) ?? {}
  return {
    totalReviews: pickNum(o, "totalReviews", "total_reviews"),
    avgRating: pickNum(o, "avgRating", "avg_rating"),
    verifiedReviews: pickNum(o, "verifiedReviews", "verified_reviews"),
    reviewsLast30Days: pickNum(o, "reviewsLast30Days", "reviews_last_30_days"),
  }
}

function normalizeNotificationSnapshot(raw: unknown): NotificationAnalyticsSnapshot {
  const o = asRecord(raw) ?? {}
  return {
    totalRecipients: pickNum(o, "totalRecipients", "total_recipients"),
    activeRecipients: pickNum(o, "activeRecipients", "active_recipients"),
    templateCount: pickNum(o, "templateCount", "template_count"),
    customTemplateCount: pickNum(o, "customTemplateCount", "custom_template_count"),
  }
}

export async function getAdminSellerAnalyticsSnapshot(token: string) {
  const raw = await api<unknown>("/api/v1/admin/sellers/analytics", { token })
  return normalizeSellerSnapshot(raw)
}

export async function getAdminCatalogAnalyticsSnapshot(token: string) {
  const raw = await api<unknown>("/api/v1/products/admin/analytics", { token })
  return normalizeCatalogSnapshot(raw)
}

export async function getAdminPaymentAnalyticsSnapshot(token: string) {
  const raw = await api<unknown>("/api/v1/admin/payouts/summary", { token })
  return normalizePaymentSnapshot(raw)
}

export async function getAdminReviewAnalyticsSnapshot(token: string) {
  const raw = await api<unknown>("/api/v1/reviews/admin/analytics", { token })
  return normalizeReviewSnapshot(raw)
}

export async function getAdminNotificationAnalyticsSnapshot(token: string) {
  const raw = await api<unknown>("/api/v1/admin/notification-analytics", { token })
  return normalizeNotificationSnapshot(raw)
}

export async function getSellerAnalytics(
  token: string,
  storeIds: string[],
  startDate: string,
  endDate: string,
): Promise<SellerAnalyticsResponse> {
  const params = new URLSearchParams()
  storeIds.forEach((id) => params.append("storeIds", id))
  params.set("startDate", startDate)
  params.set("endDate", endDate)
  const raw = await api<unknown>(`/api/v1/analytics/seller?${params.toString()}`, { token })
  return normalizeSellerAnalytics(raw)
}

// ── Analytics visibility (config — separate from per-region feature flags) ─

export interface AnalyticsAvailability {
  adminAnalyticsEnabled: boolean
  sellerAnalyticsEnabled: boolean
}

interface RawAnalyticsAvailability {
  admin_analytics_enabled: boolean
  seller_analytics_enabled: boolean
}

function mapAnalyticsAvailability(r: RawAnalyticsAvailability): AnalyticsAvailability {
  return {
    adminAnalyticsEnabled: r.admin_analytics_enabled,
    sellerAnalyticsEnabled: r.seller_analytics_enabled,
  }
}

/** Authenticated read for admin/seller dashboards (realm roles seller or admin). */
export async function getPortalAnalyticsAvailability(token: string): Promise<AnalyticsAvailability> {
  const raw = await api<RawAnalyticsAvailability>("/api/v1/seller/config/analytics", { token })
  return mapAnalyticsAvailability(raw)
}

export async function getAdminAnalyticsSettings(token: string): Promise<AnalyticsAvailability> {
  const raw = await api<RawAnalyticsAvailability>("/api/v1/admin/config/analytics", { token })
  return mapAnalyticsAvailability(raw)
}

export async function putAdminAnalyticsSettings(
  token: string,
  s: AnalyticsAvailability,
): Promise<void> {
  await api<{ status: string }>("/api/v1/admin/config/analytics", {
    method: "PUT",
    body: {
      admin_analytics_enabled: s.adminAnalyticsEnabled,
      seller_analytics_enabled: s.sellerAnalyticsEnabled,
    },
    token,
  })
}

// ── AI Provider Settings ───────────────────────────────────────────────────

export interface AiSettings {
  provider: string
  available_providers: string[]
  gemini_configured: boolean
  claude_configured: boolean
}

export async function getAiSettings(token: string): Promise<AiSettings> {
  return api<AiSettings>("/api/v1/ai/admin/settings", { token })
}

export async function updateAiProvider(token: string, provider: string): Promise<AiSettings> {
  return api<AiSettings>("/api/v1/ai/admin/settings", {
    method: "PUT",
    body: { provider },
    token,
  })
}

// ── Behaviour Tracking ────────────────────────────────────────────────────────

const CLIENT_ID_KEY = "afrotransact_cid"

/** Stable anonymous client ID — created once in localStorage, persists across sessions. */
export function getOrCreateClientId(): string {
  try {
    const existing = localStorage.getItem(CLIENT_ID_KEY)
    if (existing) return existing
    const id = crypto.randomUUID()
    localStorage.setItem(CLIENT_ID_KEY, id)
    return id
  } catch {
    return "anon"
  }
}

interface TrackEventPayload {
  event_type: "view" | "cart_add" | "search"
  product_id?: string
  category?: string
  query?: string
  client_id?: string
}

/** Fire-and-forget — never throws, never awaited for UX. */
export function trackEvent(payload: TrackEventPayload, token?: string): void {
  const body: TrackEventPayload = {
    ...payload,
    client_id: payload.client_id ?? getOrCreateClientId(),
  }
  fetch(`${API_BASE}/api/v1/ai/events/track`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  }).catch(() => {}) // intentionally swallowed
}

// ── Recommendations ───────────────────────────────────────────────────────────

export interface RecommendationsResponse {
  results: SearchResult[]
  based_on: string[] | null
  total: number
}

export async function getRecommendations(
  token?: string,
  limit = 8,
): Promise<RecommendationsResponse> {
  const clientId = getOrCreateClientId()
  const qs = new URLSearchParams({ limit: String(limit), client_id: clientId })
  return api<RecommendationsResponse>(`/api/v1/ai/recommendations?${qs}`, token ? { token } : {})
}

// ── Seller Invites ────────────────────────────────────────────────────────────

export type SellerInviteStatus = "pending" | "consumed" | "expired" | "revoked"

export interface SellerInvite {
  id: string
  email: string
  firstName: string
  lastName: string
  kcUserId: string
  expiresAt: string
  status: SellerInviteStatus
  createdAt: string
  notes?: string | null
}

export interface CreateSellerInvitePayload {
  email: string
  firstName: string
  lastName: string
  expiresInHours?: number
  notes?: string
}

export function createSellerInvite(token: string, payload: CreateSellerInvitePayload) {
  return api<SellerInvite>("/api/v1/admin/seller-invites", {
    method: "POST",
    body: payload,
    token,
  })
}

export function resendSellerInvite(token: string, inviteId: string) {
  return api<SellerInvite>(
    `/api/v1/admin/seller-invites/${encodeURIComponent(inviteId)}/resend`,
    { method: "POST", token },
  )
}

export interface ListSellerInvitesParams {
  status?: SellerInviteStatus
  email?: string
  page?: number
  size?: number
}

export function listSellerInvites(token: string, params: ListSellerInvitesParams = {}) {
  const qs = new URLSearchParams()
  if (params.status) qs.set("status", params.status)
  if (params.email) qs.set("email", params.email)
  if (params.page !== undefined) qs.set("page", String(params.page))
  if (params.size !== undefined) qs.set("size", String(params.size))
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  return api<Page<SellerInvite>>(`/api/v1/admin/seller-invites${suffix}`, { token })
}

export function getSellerInviteStats(token: string) {
  return api<Record<SellerInviteStatus, number>>(`/api/v1/admin/seller-invites/stats`, { token })
}

export function revokeSellerInvite(token: string, id: string) {
  return api<{ id: string; status: "revoked" }>(
    `/api/v1/admin/seller-invites/${encodeURIComponent(id)}/revoke`,
    { method: "POST", token },
  )
}

// ── Wishlist (User-Profile service) ──

interface WishlistPage {
  content: string[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export interface WishlistMergeResult {
  requested: number
  added: number
  alreadyPresent: number
}

export function getWishlist(token: string, page = 0, size = 100) {
  return api<WishlistPage>(`/api/v1/wishlist?page=${page}&size=${size}`, { token })
}

export function addToWishlist(token: string, productId: string) {
  return api<void>("/api/v1/wishlist", { method: "POST", body: { productId }, token })
}

export function removeFromWishlist(token: string, productId: string) {
  return api<void>(`/api/v1/wishlist/${productId}`, { method: "DELETE", token })
}

export function mergeWishlist(token: string, productIds: string[]) {
  return api<WishlistMergeResult>("/api/v1/wishlist/merge", {
    method: "POST",
    body: { productIds },
    token,
  })
}

export { API_BASE }

// ── Public: Waitlist ─────────────────────────────────────────────────────
// Captures emails for buyers whose service zone is coming_soon, disabled, or
// not_serviced. POST-only public endpoint; backend dedupes via UNIQUE(email,
// country_code) so retries are safe.

export interface WaitlistSignupInput {
  email: string
  countryCode: string
  subdivisionCode?: string | null
  city?: string | null
  source?: string
}

export interface WaitlistSignupResult {
  ok: boolean
  existing?: boolean
}

export async function postWaitlistSignup(input: WaitlistSignupInput): Promise<WaitlistSignupResult> {
  const body: Record<string, string> = {
    email: input.email,
    country_code: input.countryCode,
  }
  if (input.subdivisionCode) body.subdivision_code = input.subdivisionCode
  if (input.city) body.city = input.city
  body.source = input.source ?? "storefront"
  return api<WaitlistSignupResult>(`/api/v1/waitlist`, {
    method: "POST",
    body,
  })
}

export interface WaitlistRow {
  id: string
  email: string
  country_code: string
  subdivision_code: string | null
  city: string | null
  source: string
  created_at: string
}

export async function listWaitlistSignups(
  token: string,
  opts: { countryCode?: string; limit?: number } = {},
): Promise<{ signups: WaitlistRow[]; limit: number }> {
  const params = new URLSearchParams()
  if (opts.countryCode) params.set("country_code", opts.countryCode)
  if (opts.limit) params.set("limit", String(opts.limit))
  const qs = params.toString()
  return api<{ signups: WaitlistRow[]; limit: number }>(
    `/api/v1/admin/waitlist${qs ? `?${qs}` : ""}`,
    { token },
  )
}

// ─── Phase 9: Catalog items (Amazon ASIN-equivalent) ───────────────────────
//
// Admin-managed master catalog. AT-Inv operators and third-party sellers
// attach offers against these items. See
// inventory/docs/architecture-target-state.md.

export interface CatalogItem {
  id: string
  itemNumber: string
  title: string
  description: string
  brand?: string | null
  slug: string
  productType: string
  status: "draft" | "published" | "suppressed"
  tags: string[]
  highlights: string  // JSON string of string[]
  metaTitle?: string | null
  metaDescription?: string | null
  submittedByStore?: string | null
  submittedAt?: string | null
  publishedAt?: string | null
  suppressedAt?: string | null
  createdAt: string
  updatedAt: string
  variants: CatalogItemVariant[]
  images: CatalogItemImage[]
  categoryIds: string[]
}

export interface CatalogItemVariant {
  id: string
  itemId: string
  variantSku: string
  gtin?: string | null
  name?: string | null
  attributeValues: string  // JSON string
  weightKg?: number | null
  dimensions?: string | null
  imageId?: string | null
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface CatalogItemImage {
  id: string
  itemId: string
  url: string
  altText?: string | null
  sortOrder: number
  isPrimary: boolean
  createdAt: string
}

export interface CreateCatalogItemVariantRequest {
  variantSku?: string
  gtin?: string
  name?: string
  attributeValues?: string
  weightKg?: number
  dimensions?: string
  isDefault?: boolean
}

export interface CreateCatalogItemRequest {
  title: string
  description?: string
  brand?: string
  productType?: string
  tags?: string[]
  highlights?: string  // JSON-encoded string of string[]
  metaTitle?: string
  metaDescription?: string
  categoryIds?: string[]
  variants: CreateCatalogItemVariantRequest[]
}

export interface UpdateCatalogItemRequest {
  title?: string
  description?: string
  brand?: string
  productType?: string
  status?: "draft" | "published" | "suppressed"
  tags?: string[]
  highlights?: string
  metaTitle?: string
  metaDescription?: string
  categoryIds?: string[]  // present = replace-all; omit = no change
}

export interface CreateCatalogItemImageRequest {
  url: string
  altText?: string
  sortOrder?: number
  isPrimary?: boolean
}

export function listCatalogItems(
  token: string,
  params: { q?: string; status?: string; page?: number; size?: number; sort?: string } = {},
): Promise<Page<CatalogItem>> {
  const sp = new URLSearchParams()
  if (params.q) sp.set("q", params.q)
  if (params.status) sp.set("status", params.status)
  if (params.page != null) sp.set("page", String(params.page))
  if (params.size != null) sp.set("size", String(params.size))
  if (params.sort) sp.set("sort", params.sort)
  const qs = sp.toString()
  return api<Page<CatalogItem>>(
    `/api/v1/catalog/items${qs ? `?${qs}` : ""}`,
    { token },
  )
}


export function getCatalogItem(token: string, id: string): Promise<CatalogItem> {
  return api<CatalogItem>(`/api/v1/catalog/items/${id}`, { token })
}

export function createCatalogItem(
  token: string,
  body: CreateCatalogItemRequest,
): Promise<CatalogItem> {
  return api<CatalogItem>(`/api/v1/catalog/items`, { method: "POST", body, token })
}

export function updateCatalogItem(
  token: string,
  id: string,
  body: UpdateCatalogItemRequest,
): Promise<CatalogItem> {
  return api<CatalogItem>(`/api/v1/catalog/items/${id}`, { method: "PATCH", body, token })
}

export function publishCatalogItem(token: string, id: string): Promise<CatalogItem> {
  return api<CatalogItem>(`/api/v1/catalog/items/${id}/publish`, { method: "POST", body: {}, token })
}

export function suppressCatalogItem(token: string, id: string): Promise<CatalogItem> {
  return api<CatalogItem>(`/api/v1/catalog/items/${id}/suppress`, { method: "POST", body: {}, token })
}

export function addCatalogItemVariant(
  token: string,
  itemId: string,
  body: CreateCatalogItemVariantRequest,
): Promise<CatalogItemVariant> {
  return api<CatalogItemVariant>(`/api/v1/catalog/items/${itemId}/variants`, {
    method: "POST", body, token,
  })
}

export function addCatalogItemImage(
  token: string,
  itemId: string,
  body: CreateCatalogItemImageRequest,
): Promise<CatalogItemImage> {
  return api<CatalogItemImage>(`/api/v1/catalog/items/${itemId}/images`, {
    method: "POST", body, token,
  })
}

export function removeCatalogItemImage(token: string, itemId: string, imageId: string): Promise<void> {
  return api<void>(`/api/v1/catalog/items/${itemId}/images/${imageId}`, {
    method: "DELETE", token,
  })
}

export function reorderCatalogItemImages(token: string, itemId: string, imageIds: string[]): Promise<void> {
  return api<void>(`/api/v1/catalog/items/${itemId}/images/reorder`, {
    method: "PUT", body: { imageIds }, token,
  })
}

// Phase 9.4 — seller "Add from catalog" flow.
export interface CreateOfferFromCatalogRequest {
  catalogItemId: string
  storeId: string
  internalSkuPrefix?: string
  variants: Array<{
    catalogVariantId: string
    price: number
    compareAtPrice?: number
    currency?: string
    stockQuantity?: number
  }>
}

export function createOfferFromCatalog(
  token: string,
  body: CreateOfferFromCatalogRequest,
): Promise<Product> {
  return api<Product>(`/api/v1/products/from-catalog`, {
    method: "POST", body, token,
  })
}

// ─── Phase 9.6 — buyer-side flip (catalog item + Buy Box) ──────────────────

export interface OfferSummary {
  offerId: string
  storeId: string
  variantId: string
  variantSku: string
  variantName?: string | null
  price: number
  compareAtPrice?: number | null
  currency: string
  stockQuantity: number
  condition: string
}

export interface CatalogItemBuyBox {
  id: string
  itemNumber: string
  title: string
  description: string
  brand?: string | null
  slug: string
  productType: string
  status: "draft" | "published" | "suppressed"
  tags: string[]
  highlights: string
  images: CatalogItemImage[]
  categoryIds: string[]
  publishedAt?: string | null
  buyBox: OfferSummary | null
  otherOffers: OfferSummary[]
  totalOffers: number
  /**
   * Phase 9.8 — Buy Box decision metadata. `reason` is a machine token
   * ("cheapest_in_stock" | "no_offers" | "no_eligible_offers");
   * `ineligible` is keyed by offerId with a short rejection code
   * (e.g. "out_of_stock", "currency_mismatch:NGN_vs_USD"). The seller
   * dashboard reads its own offer's entry to show a "Why isn't my offer
   * winning?" tooltip.
   */
  buyBoxDecision: {
    reason: string
    eligibleCount: number
    ineligible: Record<string, string>
  }
}

export function getCatalogItemBuyBoxBySlug(
  slug: string,
  opts: { revalidate?: number } = {},
): Promise<CatalogItemBuyBox> {
  return api<CatalogItemBuyBox>(
    `/api/v1/catalog/items/by-slug/${encodeURIComponent(slug)}/with-offers`,
    opts.revalidate ? { next: { revalidate: opts.revalidate } } : {},
  )
}

export function listCatalogItemsWithBuyBox(
  opts: { page?: number; size?: number; revalidate?: number } = {},
): Promise<Page<CatalogItemBuyBox>> {
  const sp = new URLSearchParams()
  if (opts.page != null) sp.set("page", String(opts.page))
  if (opts.size != null) sp.set("size", String(opts.size))
  const qs = sp.toString()
  return api<Page<CatalogItemBuyBox>>(
    `/api/v1/catalog/items/with-buybox${qs ? `?${qs}` : ""}`,
    opts.revalidate ? { next: { revalidate: opts.revalidate } } : {},
  )
}

/**
 * Public read of a catalog item by id. GET endpoints on /api/v1/catalog/items
 * are permitAll in SecurityConfig — no token required. Used by the
 * /p/by-id/{id} redirect to resolve search-result hits → catalog slug.
 */
export function getCatalogItemPublic(id: string): Promise<CatalogItem> {
  return api<CatalogItem>(`/api/v1/catalog/items/${id}`, {
    next: { revalidate: 60 },
  })
}
