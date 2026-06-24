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

async function forward(
  request: Request,
  id: string,
  method: "PUT" | "PATCH" | "DELETE",
): Promise<Response> {
  const token = await authedToken()
  if (token === null) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const body = method === "DELETE" ? undefined : await request.text()
  try {
    const res = await fetch(`${API_BASE}/api/v1/admin/promotions/${encodeURIComponent(id)}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
    })
    const text = await res.text()
    const data = text ? safeParse(text) : null
    return NextResponse.json(data ?? { status: res.ok ? "ok" : "error" }, { status: res.status })
  } catch (err) {
    console.error(`[admin/promotions/${id}] ${method} error:`, err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

function safeParse(text: string): unknown {
  try { return JSON.parse(text) } catch { return null }
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return forward(request, id, "PUT")
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return forward(request, id, "PATCH")
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return forward(request, id, "DELETE")
}
