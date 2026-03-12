import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"

export interface AdminUserDTO {
  id: string
  username: string
  firstName: string
  lastName: string
  email: string
  emailVerified: boolean
  enabled: boolean
  createdTimestamp: number
  roles: string[]
  registrationRole?: string
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const roles = session.user.roles ?? []
  if (!roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search") || ""
  const page = searchParams.get("page") || "0"
  const size = searchParams.get("size") || "500"

  try {
    const token = (session as any).accessToken ?? ""
    const params = new URLSearchParams({ page, size })
    if (search) params.set("search", search)

    const res = await fetch(
      `${API_BASE}/api/v1/users/admin/all?${params}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    )

    if (!res.ok) {
      const text = await res.text()
      console.error(`[admin/users] User profile service fetch failed: ${res.status} ${text}`)
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: res.status },
      )
    }

    const data = await res.json()
    const profiles = data.content ?? data

    const users: AdminUserDTO[] = profiles.map((p: any) => ({
      id: p.id,
      username: p.email,
      firstName: p.firstName ?? "",
      lastName: p.lastName ?? "",
      email: p.email ?? "",
      emailVerified: true,
      enabled: true,
      createdTimestamp: p.createdAt ? new Date(p.createdAt).getTime() : 0,
      roles: p.role ? [p.role] : ["buyer"],
      registrationRole: p.role,
    }))

    return NextResponse.json(users)
  } catch (e) {
    console.error("[admin/users] Error:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
