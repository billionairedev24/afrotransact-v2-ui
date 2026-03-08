"use client"

import { useQuery } from "@tanstack/react-query"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`)
  if (!res.ok) throw new Error(`Failed to fetch ${path}`)
  return res.json()
}

export interface ProductListResponse {
  content: ProductSummary[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export interface ProductSummary {
  id: string
  storeId: string
  title: string
  description: string
  slug: string
  status: string
  productType: string
  publishedAt: string
  variants: VariantSummary[]
  images: ImageSummary[]
  categories: CategorySummary[]
}

export interface VariantSummary {
  id: string
  sku: string
  name: string
  price: number
  compareAtPrice?: number
  currency: string
  stockQuantity: number
  weightKg?: number
}

export interface ImageSummary {
  id: string
  url: string
  altText?: string
  sortOrder: number
}

export interface CategorySummary {
  id: string
  name: string
  slug: string
}

export function useProduct(idOrSlug: string, bySlug = false) {
  return useQuery({
    queryKey: ["product", idOrSlug],
    queryFn: () =>
      fetchJSON<ProductSummary>(
        bySlug
          ? `/api/v1/products/slug/${idOrSlug}`
          : `/api/v1/products/${idOrSlug}`
      ),
    enabled: !!idOrSlug,
  })
}

export function useStoreProducts(storeId: string, page = 0, size = 20) {
  return useQuery({
    queryKey: ["store-products", storeId, page],
    queryFn: () =>
      fetchJSON<ProductListResponse>(
        `/api/v1/products/store/${storeId}?page=${page}&size=${size}`
      ),
    enabled: !!storeId,
  })
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => fetchJSON<CategorySummary[]>("/api/v1/categories"),
    staleTime: 5 * 60 * 1000,
  })
}
