const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

interface FetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown
  token?: string
}

async function api<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { body, token, headers: extraHeaders, ...rest } = opts

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extraHeaders as Record<string, string>),
  }
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
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

export function getProductBySlug(slug: string) {
  return api<Product>(`/api/v1/products/slug/${slug}`)
}

export function getProductById(id: string) {
  return api<Product>(`/api/v1/products/${id}`)
}

export function getStoreProducts(storeId: string, page = 0, size = 20) {
  return api<Page<Product>>(`/api/v1/products/store/${storeId}?page=${page}&size=${size}`)
}

export function getCategories() {
  return api<CategoryRef[]>("/api/v1/categories")
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

export function searchProducts(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString()
  return api<SearchResponse>(`/api/v1/search?${qs}`)
}

// ── Autocomplete suggestions ──

export interface SearchSuggestion {
  text: string
  product_id: string
  image_url: string | null
  category: string
  price: number
}

export interface SuggestResponse {
  suggestions: SearchSuggestion[]
}

export function searchSuggest(q: string, size = 8) {
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
    productTitle?: string; variantName?: string; imageUrl?: string;
  }[],
) {
  return api<CartDto>("/api/v1/cart/merge", { method: "POST", body: items, token })
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

export function getAllStores() {
  return api<StoreInfo[]>("/api/v1/stores")
}

export function getStoreById(id: string) {
  return api<StoreInfo>(`/api/v1/stores/${id}`)
}

export function getStoreBySlug(slug: string) {
  return api<StoreInfo>(`/api/v1/stores/slug/${slug}`)
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
  commissionRate: number
  contactEmail: string | null
  createdAt: string
  submittedAt: string | null
  approvedAt: string | null
}

export function getCurrentSeller(token: string) {
  return api<SellerInfo>("/api/v1/seller/me", { token })
}

export function registerSeller(token: string, businessName: string, taxId?: string) {
  return api<SellerInfo>("/api/v1/seller/register", {
    method: "POST",
    body: { businessName, taxId },
    token,
  })
}

export function getOnboardingLink(token: string) {
  return api<{ url: string; accountId: string }>("/api/v1/seller/me/onboarding", { token })
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
  deliveryRadiusMiles: number
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
  commissionCents: number
  shippingCostCents: number
  transferAmountCents: number
  fulfillmentStatus: string
  trackingNumber: string | null
  items: OrderItemDto[]
}

export interface OrderDto {
  id: string
  orderNumber: string
  status: string
  subtotalCents: number
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
) {
  const params = new URLSearchParams({ status })
  if (trackingNumber) params.set("trackingNumber", trackingNumber)
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
  totalWeightLbs?: number
}

export interface CheckoutResponse {
  orderId: string
  orderNumber: string
  subtotalCents: number
  taxCents: number
  shippingCostCents: number
  totalCents: number
  currency: string
  paymentClientSecret: string | null
  status: string
}

export function checkout(token: string, data: CheckoutRequest) {
  return api<CheckoutResponse>("/api/v1/orders/checkout", {
    method: "POST",
    body: data,
    token,
  })
}

// ── Admin ──

export function getAdminPlans(token: string) {
  return api<SubscriptionPlan[]>("/api/v1/admin/subscription/plans", { token })
}

export function createPlan(token: string, data: Record<string, unknown>) {
  return api<SubscriptionPlan>("/api/v1/admin/subscription/plans", {
    method: "POST",
    body: data,
    token,
  })
}

export function updatePlan(token: string, planId: string, data: Record<string, unknown>) {
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

export async function createRegion(token: string, data: Record<string, unknown>): Promise<Region> {
  const raw = await api<RawRegion>("/api/v1/regions", { method: "POST", body: data, token })
  return mapRegion(raw)
}

export async function updateRegion(token: string, id: string, data: Record<string, unknown>): Promise<Region> {
  const raw = await api<RawRegion>(`/api/v1/regions/${id}`, { method: "PUT", body: data, token })
  return mapRegion(raw)
}

export function deleteRegion(token: string, id: string) {
  return api<void>(`/api/v1/regions/${id}`, { method: "DELETE", token })
}

// ── Admin: Feature Flags (Config service) ──

export interface FeatureFlag {
  id: string
  key: string
  enabled: boolean
  regionId: string
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
  }
}

export async function getFeatureFlags(token: string, regionId: string): Promise<FeatureFlag[]> {
  const res = await api<{ features: RawFeature[] }>(`/api/v1/regions/${regionId}/features`, { token })
  return (res.features ?? []).map(mapFeature)
}

export async function upsertFeatureFlag(
  token: string,
  regionId: string,
  data: { key: string; enabled: boolean }
): Promise<FeatureFlag> {
  await api<{ status: string }>(`/api/v1/regions/${regionId}/features`, {
    method: "POST",
    body: { feature_key: data.key, enabled: data.enabled },
    token,
  })
  // Upsert returns { status: "ok" }, so re-fetch the list and find the flag
  const all = await getFeatureFlags(token, regionId)
  return all.find((f) => f.key === data.key) ?? { id: "", key: data.key, enabled: data.enabled, regionId }
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

// ── User Profile ──

export interface UserProfile {
  id: string
  keycloakId: string
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  avatarUrl: string | null
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

export interface MediaUploadResponse {
  id: string
  url: string
  filename: string
  contentType: string
  sizeBytes: number
}

export async function uploadMedia(token: string, file: File): Promise<MediaUploadResponse> {
  const formData = new FormData()
  formData.append("file", file)

  const res = await fetch(`${API_BASE}/api/v1/media/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new ApiError(res.status, text || res.statusText, "/api/v1/media/upload")
  }
  return res.json()
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
  platformFeeCents: number
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

export { API_BASE }
