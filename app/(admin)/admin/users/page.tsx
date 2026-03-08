"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { DataTable } from "@/components/ui/DataTable"
import { Sheet, SheetHeader, SheetBody } from "@/components/ui/Sheet"
import { createColumnHelper } from "@tanstack/react-table"
import {
  Users,
  Shield,
  ShoppingBag,
  Store,
  MoreHorizontal,
  User as UserIcon,
  Calendar,
  CheckCircle2,
  XCircle,
  Copy,
} from "lucide-react"

interface AdminUser {
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

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  admin:  { label: "Admin",  className: "bg-purple-500/20 text-purple-400 border border-purple-500/30" },
  seller: { label: "Seller", className: "bg-blue-500/20 text-blue-400 border border-blue-500/30" },
  buyer:  { label: "Buyer",  className: "bg-green-500/20 text-green-400 border border-green-500/30" },
}

function classifyRoles(user: AdminUser): string[] {
  const found: string[] = []
  const lowerRoles = user.roles.map((r) => r.toLowerCase())
  if (lowerRoles.includes("admin")) found.push("admin")
  if (lowerRoles.includes("seller") || user.registrationRole === "seller") found.push("seller")
  if (found.length === 0 || (!found.includes("admin") && !found.includes("seller"))) {
    found.push("buyer")
  }
  return [...new Set(found)]
}

function formatDate(ts: number) {
  if (!ts) return "—"
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function displayName(user: AdminUser) {
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ")
  return full || user.username
}

const col = createColumnHelper<AdminUser>()

function StatCard({ label, value, icon: Icon, iconColor }: { label: string; value: number; icon: React.ElementType; iconColor: string }) {
  return (
    <div className="rounded-xl border border-white/10 p-4" style={{ background: "hsl(0 0% 11%)" }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className="mt-1 text-2xl font-bold text-white">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconColor}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

function ActionMenu({ onView }: { onView: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-44 rounded-xl border border-white/10 py-1 shadow-xl"
          style={{ background: "hsl(0 0% 11%)" }}
        >
          <button
            onClick={() => { onView(); setOpen(false) }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
          >
            <UserIcon className="h-3.5 w-3.5" /> View Details
          </button>
        </div>
      )}
    </div>
  )
}

export default function UsersPage() {
  const { status } = useSession()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [viewUser, setViewUser] = useState<AdminUser | null>(null)

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/users")
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Failed to load users (${res.status})`)
      }
      const data: AdminUser[] = await res.json()
      setUsers(data)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load users")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === "authenticated") loadUsers()
    else setLoading(false)
  }, [status, loadUsers])

  const stats = useMemo(() => {
    let admins = 0, sellers = 0, buyers = 0
    for (const user of users) {
      const roles = classifyRoles(user)
      if (roles.includes("admin")) admins++
      if (roles.includes("seller")) sellers++
      if (roles.includes("buyer")) buyers++
    }
    return { total: users.length, admins, sellers, buyers }
  }, [users])

  const columns = useMemo(() => [
    col.accessor("email", {
      header: "User",
      cell: (info) => {
        const user = info.row.original
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-sm font-semibold text-primary">
              {(user.firstName?.[0] || user.username?.[0] || "?").toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium text-white">{displayName(user)}</p>
              <p className="truncate text-xs text-gray-500">{info.getValue()}</p>
            </div>
          </div>
        )
      },
      filterFn: (row, _columnId, filterValue) => {
        const user = row.original
        const search = (filterValue as string).toLowerCase()
        return (
          displayName(user).toLowerCase().includes(search) ||
          user.email.toLowerCase().includes(search) ||
          user.username.toLowerCase().includes(search)
        )
      },
    }),
    col.display({
      id: "roles",
      header: "Roles",
      cell: (info) => {
        const roles = classifyRoles(info.row.original)
        return (
          <div className="flex flex-wrap gap-1.5">
            {roles.map((role) => {
              const badge = ROLE_BADGE[role] ?? { label: role, className: "bg-white/10 text-gray-400 border border-white/10" }
              return (
                <span key={role} className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>
                  {badge.label}
                </span>
              )
            })}
          </div>
        )
      },
      enableSorting: false,
    }),
    col.accessor("enabled", {
      header: "Status",
      cell: (info) => (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${info.getValue() ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${info.getValue() ? "bg-green-400" : "bg-red-400"}`} />
          {info.getValue() ? "Active" : "Disabled"}
        </span>
      ),
    }),
    col.accessor("createdTimestamp", {
      header: "Joined",
      cell: (info) => <span className="text-gray-400">{formatDate(info.getValue())}</span>,
    }),
    col.display({
      id: "actions",
      header: "",
      cell: (info) => <ActionMenu onView={() => setViewUser(info.row.original)} />,
      enableSorting: false,
      enableHiding: false,
      size: 50,
    }),
  ], [])

  function handleCopyId() {
    if (viewUser) {
      navigator.clipboard.writeText(viewUser.id)
      toast.success("User ID copied")
    }
  }

  if (status !== "authenticated" && !loading) {
    return <div className="py-20 text-center text-gray-400">Sign in as admin to manage users.</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <p className="mt-1 text-sm text-gray-400">All registered users across the platform.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Users" value={stats.total} icon={Users} iconColor="bg-white/10 text-white" />
        <StatCard label="Admins" value={stats.admins} icon={Shield} iconColor="bg-purple-500/10 text-purple-400" />
        <StatCard label="Sellers" value={stats.sellers} icon={Store} iconColor="bg-blue-500/10 text-blue-400" />
        <StatCard label="Buyers" value={stats.buyers} icon={ShoppingBag} iconColor="bg-green-500/10 text-green-400" />
      </div>

      <DataTable
        columns={columns}
        data={users}
        loading={loading}
        searchPlaceholder="Search by name, email, or username…"
        searchColumn="email"
        enableExport
        exportFilename="users"
        emptyMessage="No users found."
      />

      {/* User detail sheet */}
      <Sheet open={!!viewUser} onClose={() => setViewUser(null)}>
        <SheetHeader onClose={() => setViewUser(null)}>User Details</SheetHeader>
        <SheetBody>
          {viewUser && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-xl font-bold text-primary">
                  {(viewUser.firstName?.[0] || viewUser.username?.[0] || "?").toUpperCase()}
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">{displayName(viewUser)}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {classifyRoles(viewUser).map((role) => {
                      const badge = ROLE_BADGE[role] ?? { label: role, className: "bg-white/10 text-gray-400" }
                      return (
                        <span key={role} className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Info grid */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Account Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      label: "User ID",
                      value: viewUser.id,
                      icon: <Copy className="h-3 w-3" />,
                      action: handleCopyId,
                    },
                    { label: "Username", value: viewUser.username },
                    { label: "Email", value: viewUser.email || "—" },
                    { label: "Email Status", value: viewUser.emailVerified ? "Verified" : "Unverified" },
                    { label: "Account Status", value: viewUser.enabled ? "Active" : "Disabled" },
                    { label: "Joined", value: formatDate(viewUser.createdTimestamp) },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-white/10 p-3.5" style={{ background: "hsl(0 0% 9%)" }}>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1">{item.label}</p>
                      <div className="flex items-center gap-2">
                        <p className="break-all text-sm font-medium text-white truncate">{item.value}</p>
                        {"action" in item && item.action && (
                          <button onClick={item.action} className="shrink-0 rounded p-1 text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
                            {item.icon}
                          </button>
                        )}
                      </div>
                      {item.label === "Email Status" && (
                        <div className="mt-1.5">
                          {viewUser.emailVerified ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-green-400"><CheckCircle2 className="h-3 w-3" />Verified</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-yellow-400"><XCircle className="h-3 w-3" />Not verified</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Activity */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Activity</h3>
                <div className="flex items-center gap-3 rounded-xl border border-white/10 p-3.5" style={{ background: "hsl(0 0% 9%)" }}>
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-xs text-gray-500">Member since</p>
                    <p className="text-sm text-white">{formatDate(viewUser.createdTimestamp)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </SheetBody>
      </Sheet>
    </div>
  )
}
