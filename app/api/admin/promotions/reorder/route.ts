import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  const roles = session.user.roles ?? []
  if (!roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const token = (session as unknown as { accessToken?: string }).accessToken ?? ""
  const body = await request.text()
  try {
    const res = await fetch(`${API_BASE}/api/v1/admin/promotions/reorder`, {
      method: "PATCH",
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
    console.error("[admin/promotions/reorder] PATCH error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
