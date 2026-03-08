"use client"

import { useQuery } from "@tanstack/react-query"
import { useLocationStore } from "@/stores/location-store"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"

export interface SearchParams {
  q?: string
  category?: string
  minPrice?: number
  maxPrice?: number
  minRating?: number
  radius?: number
  sortBy?: string
  page?: number
  size?: number
}

export interface SearchResult {
  productId: string
  storeId: string
  storeName: string
  title: string
  description: string
  productType: string
  categories: string[]
  minPrice: number
  maxPrice: number
  currency: string
  inStock: boolean
  imageUrl?: string
  avgRating: number
  reviewCount: number
  distanceMiles?: number
}

export interface SearchResponse {
  results: SearchResult[]
  total: number
  page: number
  pageSize: number
  facets: {
    categories: { key: string; label: string; count: number }[]
    priceRanges: { key: string; label: string; count: number }[]
    ratings: { key: string; label: string; count: number }[]
  }
}

export function useSearch(params: SearchParams) {
  const location = useLocationStore((s) => s.location)

  const queryString = new URLSearchParams()
  if (params.q) queryString.set("q", params.q)
  if (location) {
    queryString.set("lat", String(location.lat))
    queryString.set("lon", String(location.lon))
  }
  if (params.radius) queryString.set("radius", String(params.radius))
  if (params.category) queryString.set("category", params.category)
  if (params.minPrice !== undefined) queryString.set("min_price", String(params.minPrice))
  if (params.maxPrice !== undefined) queryString.set("max_price", String(params.maxPrice))
  if (params.minRating !== undefined) queryString.set("min_rating", String(params.minRating))
  if (params.sortBy) queryString.set("sort_by", params.sortBy)
  if (params.page !== undefined) queryString.set("page", String(params.page))
  if (params.size !== undefined) queryString.set("size", String(params.size))

  return useQuery({
    queryKey: ["search", params, location?.lat, location?.lon],
    queryFn: async (): Promise<SearchResponse> => {
      const res = await fetch(`${API_URL}/api/v1/search?${queryString.toString()}`)
      if (!res.ok) throw new Error("Search failed")
      return res.json()
    },
  })
}
