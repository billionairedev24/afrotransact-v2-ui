import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/site"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Keep private/transactional + API surfaces out of the index.
        disallow: [
          "/admin",
          "/dashboard",
          "/account",
          "/checkout",
          "/cart",
          "/orders",
          "/auth",
          "/onboarding",
          "/api/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
