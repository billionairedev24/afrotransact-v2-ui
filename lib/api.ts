const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

interface FetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown
  token?: string
  /**
   * Opt-in Next.js cache hints for Server Component fetches.
   * Pass `revalidate` (seconds) and/or `tags` to make the fetch cacheable.
   * If provided, this overrides the default `cache: "no-store"` behavior.
   */
  next?: { revalidate?: number | false; tags?: string[] }
}

async function api<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { body, token, headers: extraHeaders, next, cache, ...rest } = opts

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

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    ...cacheOpts,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    let userMessage = res.statusText
    try {
      const parsed = JSON.parse(text)
      userMessage = parsed.error || parsed.message || res.statusText
    } catch {
      if (text) userMessage = text
    }
    // Log every API error at source so it's always captured regardless of how the caller handles it
    console.error(`[API] ${opts.method ?? "GET"} ${path} → ${res.status}`, userMessage)
    throw new ApiError(res.status, userMessage, path)
  }

  if (res.status === 204) return undefined as T

  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text)
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
  return api<Page<Product>>(`/api/v1/products/store/${storeId}?page=${page}&size=${size}`)
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
  highlight_title: string | null
  highlight_description: string | null
  score: number | null
  slug?: string
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
  rating: number
  title: string | null
  body: string | null
  verified_purchase: boolean
  created_at: string
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
  commissionRate: number
  contactEmail: string | null
  createdAt: string
  submittedAt: string | null
  approvedAt: string | null
}

export function getCurrentSeller(token: string) {
  return api<SellerInfo>("/api/v1/seller/me", { token })
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

export function submitOnboardingForReview(token: string) {
  return api<OnboardingProgress>("/api/v1/seller/onboarding/submit", { method: "POST", token })
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
  createdAt: string
  updatedAt: string
}

export function getSellerStores(token: string, sellerId: string) {
  return api<StoreDetail[]>(`/api/v1/stores/seller/${sellerId}`, { token })
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
  return api<Page<OrderDto>>(`/api/v1/orders/store/${storeId}?page=${page}&size=${size}`, { token })
}

export function getBuyerOrders(token: string, page = 0, size = 20) {
  return api<Page<OrderDto>>(`/api/v1/orders?page=${page}&size=${size}`, { token })
}

export function getOrderByNumber(token: string, orderNumber: string) {
  return api<OrderDto>(`/api/v1/orders/${orderNumber}`, { token })
}

export function getAdminOrders(token: string, page = 0, size = 20) {
  return api<Page<OrderDto>>(`/api/v1/orders/admin/all?page=${page}&size=${size}`, { token })
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

export function validateCoupon(token: string, code: string, subtotalCents: number, regionId?: string) {
  return api<ValidateCouponResponse>("/api/v1/coupons/validate", {
    method: "POST",
    body: { code, subtotalCents, regionId },
    token,
  })
}

export function checkout(token: string, data: CheckoutRequest) {
  return api<CheckoutResponse>("/api/v1/orders/checkout", {
    method: "POST",
    body: data,
    token,
  })
}

export function getShippingQuotes(
  token: string,
  data: {
    regionId: string
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

export async function getRegions(token: string, activeOnly = false): Promise<Region[]> {
  const qs = activeOnly ? "?active=true" : ""
  const res = await api<{ regions: RawRegion[] } | RawRegion[]>(`/api/v1/regions${qs}`, { token })
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

// ── Admin: Feature Flags (Config service) ──

export interface FeatureFlag {
  id: string
  key: string
  enabled: boolean
  regionId: string
  config?: Record<string, unknown>
}

interface RawFeature {
  id: string
  region_id: string
  feature_key: string
  enabled: boolean
  config?: unknown
}

function mapFeature(f: RawFeature): FeatureFlag {
  return {
    id: f.id,
    key: f.feature_key,
    enabled: f.enabled,
    regionId: f.region_id,
    config: (f.config ?? {}) as Record<string, unknown>,
  }
}

export async function getFeatureFlags(token: string, regionId: string): Promise<FeatureFlag[]> {
  const res = await api<{ features: RawFeature[] }>(`/api/v1/admin/regions/${regionId}/features`, { token })
  return (res.features ?? []).map(mapFeature)
}

/** Storefront-safe: GET /regions/{id}/features (no admin role required). */
export async function getRegionFeatures(regionId: string): Promise<FeatureFlag[]> {
  const res = await api<{ features: RawFeature[] }>(`/api/v1/regions/${regionId}/features`)
  return (res.features ?? []).map(mapFeature)
}

export async function upsertFeatureFlag(
  token: string,
  regionId: string,
  data: { key: string; enabled: boolean; config?: Record<string, unknown> | null }
): Promise<FeatureFlag> {
  const body: Record<string, unknown> = { feature_key: data.key, enabled: data.enabled }
  if (data.config !== undefined) {
    body.config = data.config
  }
  await api<{ status: string }>(`/api/v1/admin/regions/${regionId}/features`, {
    method: "POST",
    body,
    token,
  })
  // Upsert returns { status: "ok" }, so re-fetch the list and find the flag
  const all = await getFeatureFlags(token, regionId)
  return all.find((f) => f.key === data.key) ?? { id: "", key: data.key, enabled: data.enabled, regionId }
}

export interface MarketplaceConfig {
  maxProductImages: number
  maxProductTags: number
}

export async function getMarketplaceConfig(regionId: string): Promise<MarketplaceConfig> {
  try {
    const res = await api<{ features: RawFeature[] }>(`/api/v1/regions/${regionId}/features`)
    const marketplace = (res.features ?? []).find((f) => f.feature_key === "marketplace_enabled")
    const cfg = (marketplace?.config ?? {}) as Record<string, unknown>
    return {
      maxProductImages: typeof cfg.max_product_images === "number" ? cfg.max_product_images : 8,
      maxProductTags: typeof cfg.max_product_tags === "number" ? cfg.max_product_tags : 10,
    }
  } catch {
    return { maxProductImages: 8, maxProductTags: 10 }
  }
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
  const params = new URLSearchParams({ page: String(page), size: String(size) })
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

export function getAdminSellers(token: string, status?: string, page = 0, size = 20, onboardingStatus?: string) {
  let qs = `?page=${page}&size=${size}`
  if (status) qs += `&status=${status}`
  if (onboardingStatus) qs += `&onboardingStatus=${onboardingStatus}`
  return api<Page<SellerInfo>>(`/api/v1/admin/sellers${qs}`, { token })
}

export function approveSeller(token: string, id: string) {
  return api<SellerInfo>(`/api/v1/admin/sellers/${id}/approve`, { method: "POST", token })
}

export function suspendSeller(token: string, id: string) {
  return api<SellerInfo>(`/api/v1/admin/sellers/${id}/suspend`, { method: "POST", token })
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
  createdAt: string
}

export function getUserProfile(token: string) {
  return api<UserProfile>("/api/v1/users/me", { token })
}

export function updateUserProfile(token: string, data: Record<string, unknown>) {
  return api<UserProfile>("/api/v1/users/me", { method: "PUT", body: data, token })
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
  createdAt: string
  updatedAt: string
}

export function getAddresses(token: string) {
  return api<UserAddress[]>("/api/v1/users/me/addresses", { token })
}

/**
 * Checkout: ensures buyer profile exists (GET /me), then loads saved addresses.
 * If the address list endpoint fails (routing/outage), `addresses` is empty and `addressesUnavailable` is true.
 */
export async function loadCheckoutShippingContext(token: string): Promise<{
  profile: UserProfile
  addresses: UserAddress[]
  addressesUnavailable: boolean
}> {
  const profile = await getUserProfile(token)
  let addresses: UserAddress[] = []
  let addressesUnavailable = false
  try {
    addresses = await getAddresses(token)
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 502 || e.status === 503)) {
      addresses = []
      addressesUnavailable = true
    } else {
      throw e
    }
  }
  return { profile, addresses, addressesUnavailable }
}

export function createAddress(token: string, data: {
  label?: string; line1: string; line2?: string; city: string; state: string; postalCode: string; countryCode: string; isDefault?: boolean
}) {
  return api<UserAddress>("/api/v1/users/me/addresses", { method: "POST", body: data, token })
}

export function updateAddress(token: string, id: string, data: Record<string, unknown>) {
  return api<UserAddress>(`/api/v1/users/me/addresses/${id}`, { method: "PUT", body: data, token })
}

export function deleteAddress(token: string, id: string) {
  return api<void>(`/api/v1/users/me/addresses/${id}`, { method: "DELETE", token })
}

export function setDefaultAddress(token: string, id: string) {
  return api<UserAddress>(`/api/v1/users/me/addresses/${id}/default`, { method: "PUT", token })
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
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  if (status) params.set("status", status)
  return api<Page<TransferRecord>>(`/api/v1/payouts/store/${storeId}?${params}`, { token })
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

export function updateEmailTemplate(token: string, slug: string, body: { subject_template: string; html_body: string; text_body: string }) {
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
  variables: VariableDef[]; use_layout: boolean;
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

// ── Config: Ads & Hero Carousel (public) ──

export interface HeroSlideConfig {
  id: string
  enabled: boolean
  order: number
  badgeText?: string | null
  badgeColor?: string | null
  headline: string
  subtext: string
  primaryCtaLabel: string
  primaryCtaHref: string
  secondaryCtaLabel?: string | null
  secondaryCtaHref?: string | null
  bg: string
  accentBlobs?: string | null
  mediaType: "none" | "image" | "video"
  mediaUrl?: string | null
  mediaOverlay?: string | null
  createdAt: string
  updatedAt: string
}

export async function getPublicAds(): Promise<import("@/lib/ads").AdConfig[]> {
  const res = await fetch(`${API_BASE}/api/v1/config/ads`)
  if (!res.ok) return []
  const data = (await res.json()) as { ads?: import("@/lib/ads").AdConfig[] }
  return data.ads ?? []
}

export function upsertAdminAd(token: string, body: import("@/lib/ads").AdConfig) {
  return api<{ status: string }>("/api/v1/admin/ads", { method: "POST", body, token })
}

export function deleteAdminAd(token: string, id: string) {
  return api<{ status: string }>(`/api/v1/admin/ads/${id}`, { method: "DELETE", token })
}

export async function getPublicHeroSlides(opts?: { revalidate?: number }): Promise<HeroSlideConfig[]> {
  const init: RequestInit =
    opts?.revalidate !== undefined
      ? { next: { revalidate: opts.revalidate, tags: ["hero-carousel"] } }
      : { cache: "no-store" }
  const res = await fetch(`${API_BASE}/api/v1/config/hero-carousel`, init)
  if (!res.ok) return []
  const data = (await res.json()) as { slides?: HeroSlideConfig[] }
  return data.slides ?? []
}

// Admin: Hero carousel

export async function getAdminHeroSlides(token: string): Promise<HeroSlideConfig[]> {
  const res = await api<{ slides?: HeroSlideConfig[] }>("/api/v1/admin/hero-carousel", { token })
  return res.slides ?? []
}

export type HeroSlideUpsertRequest = Omit<HeroSlideConfig, "createdAt" | "updatedAt">

export function upsertAdminHeroSlide(token: string, body: HeroSlideUpsertRequest) {
  return api<{ status: string }>("/api/v1/admin/hero-carousel", {
    method: "POST",
    body,
    token,
  })
}

export function deleteAdminHeroSlide(token: string, id: string) {
  return api<{ status: string }>(`/api/v1/admin/hero-carousel/${id}`, {
    method: "DELETE",
    token,
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
  return {
    totalRevenueCents: pickNum(o, "totalRevenueCents", "total_revenue_cents"),
    totalCommissionCents: pickNum(o, "totalCommissionCents", "total_commission_cents"),
    totalOrders: pickNum(o, "totalOrders", "total_orders"),
    avgOrderValueCents: pickNum(o, "avgOrderValueCents", "avg_order_value_cents"),
    totalDiscountCents: pickNum(o, "totalDiscountCents", "total_discount_cents"),
    revenueByDay: pickArr(o, "revenueByDay", "revenue_by_day").map(mapDay),
    ordersByStatus: pickArr(o, "ordersByStatus", "orders_by_status").map(mapStatus),
    revenueByRegion: pickArr(o, "revenueByRegion", "revenue_by_region").map(mapRegion),
    topStores: pickArr(o, "topStores", "top_stores").map(mapStore),
  }
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

export { API_BASE }
