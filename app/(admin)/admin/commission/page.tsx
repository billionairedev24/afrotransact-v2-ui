"use client"

import Link from "next/link"
import { Settings2, ArrowRight } from "lucide-react"

export default function CommissionPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Commission</h1>
        <p className="text-gray-500 text-sm mt-1">
          Commission is managed from one source only: platform settings.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <Settings2 className="h-5 w-5 text-primary mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-900">
              Region-level commission overrides are disabled
            </p>
            <p className="text-sm text-gray-600">
              Checkout commission now uses the global platform commission value from
              <span className="font-medium"> Settings </span>
              only. Region settings continue to control tax and shipping parameters.
            </p>
            <Link
              href="/admin/settings"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Open Platform Settings
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
