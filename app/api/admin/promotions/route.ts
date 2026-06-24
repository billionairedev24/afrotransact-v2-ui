import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"

async function authedToken(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  const roles = session.user.roles ?? []
  if (!roles.includes("admin")) return null
  return (session as unknown as { accessToken?: string }).accessToken ?? ""
}

export async function GET(request: Request) {
  const token = await authedToken()
  if (token === null) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const placement = searchParams.get("placement") ?? ""
  const qs = placement ? `?placement=${encodeURIComponent(placement)}` : ""

  try {
    const res = await fetch(`${API_BASE}/api/v1/admin/promotions${qs}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    })
    const body = await res.json().catch(() => ({ promotions: [] }))
    return NextResponse.json(body, { status: res.status })
  } catch (err) {
    console.error("[admin/promotions] GET error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const token = await authedToken()
  if (token === null) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const body = await request.text()
  try {
    const res = await fetch(`${API_BASE}/api/v1/admin/promotions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    console.error("[admin/promotions] POST error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
