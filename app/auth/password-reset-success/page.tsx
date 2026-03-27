import Link from "next/link"
import Image from "next/image"
import { CheckCircle2 } from "lucide-react"

export default function PasswordResetSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <Link href="/" className="flex items-center justify-center gap-3">
          <Image src="/logo.png" alt="AfroTransact" width={40} height={40} className="rounded-xl" />
          <div>
            <span className="text-3xl font-bold text-primary">Afro</span>
            <span className="text-3xl font-bold text-foreground">Transact</span>
          </div>
        </Link>

        <div className="rounded-xl border border-border bg-card p-8 shadow-xl shadow-black/20 space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-9 w-9 text-emerald-600 dark:text-emerald-500" strokeWidth={1.75} />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-card-foreground">Password updated</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your password was changed successfully. Sign in again with your new password to continue.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-accent"
            >
              Sign in
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-3 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
            >
              Go home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
