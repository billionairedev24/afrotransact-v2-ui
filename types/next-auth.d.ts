import { DefaultSession, DefaultUser } from "next-auth"
import { DefaultJWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session extends DefaultSession {
    accessToken?: string
    expiresAt?: number
    error?: string
    user: {
      id: string
      roles: string[]
      registrationRole?: string
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    roles?: string[]
    registrationRole?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    accessToken?: string
    refreshToken?: string
    idToken?: string
    expiresAt?: number
    roles?: string[]
    registrationRole?: string
    error?: string
    id?: string
  }
}
