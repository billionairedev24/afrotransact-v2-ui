import { createUploadthing, type FileRouter } from "uploadthing/next"
import { UploadThingError } from "uploadthing/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const f = createUploadthing()

async function authMiddleware() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new UploadThingError("Unauthorized")
  return { userId: session.user.id }
}

export const ourFileRouter = {
  storeLogo: f({
    "image/png": { maxFileSize: "2MB", maxFileCount: 1 },
    "image/jpeg": { maxFileSize: "2MB", maxFileCount: 1 },
    "image/webp": { maxFileSize: "2MB", maxFileCount: 1 },
  })
    .middleware(authMiddleware)
    .onUploadComplete(({ metadata, file }) => {
      return { url: file.ufsUrl, uploadedBy: metadata.userId }
    }),

  storeBanner: f({
    "image/png": { maxFileSize: "4MB", maxFileCount: 1 },
    "image/jpeg": { maxFileSize: "4MB", maxFileCount: 1 },
    "image/webp": { maxFileSize: "4MB", maxFileCount: 1 },
  })
    .middleware(authMiddleware)
    .onUploadComplete(({ metadata, file }) => {
      return { url: file.ufsUrl, uploadedBy: metadata.userId }
    }),

  productImage: f({
    "image/png": { maxFileSize: "4MB", maxFileCount: 5 },
    "image/jpeg": { maxFileSize: "4MB", maxFileCount: 5 },
    "image/webp": { maxFileSize: "4MB", maxFileCount: 5 },
  })
    .middleware(authMiddleware)
    .onUploadComplete(({ metadata, file }) => {
      return { url: file.ufsUrl, name: file.name, uploadedBy: metadata.userId }
    }),

  sellerMedia: f({
    "image/png": { maxFileSize: "8MB", maxFileCount: 10 },
    "image/jpeg": { maxFileSize: "8MB", maxFileCount: 10 },
    "image/webp": { maxFileSize: "8MB", maxFileCount: 10 },
    "image/gif": { maxFileSize: "8MB", maxFileCount: 10 },
  })
    .middleware(authMiddleware)
    .onUploadComplete(({ metadata, file }) => {
      return { url: file.ufsUrl, name: file.name, size: file.size, type: file.type, uploadedBy: metadata.userId }
    }),

  heroMedia: f({
    "image/png": { maxFileSize: "8MB", maxFileCount: 1 },
    "image/jpeg": { maxFileSize: "8MB", maxFileCount: 1 },
    "image/webp": { maxFileSize: "8MB", maxFileCount: 1 },
    "video/mp4": { maxFileSize: "32MB", maxFileCount: 1 },
    "video/webm": { maxFileSize: "32MB", maxFileCount: 1 },
  })
    .middleware(authMiddleware)
    .onUploadComplete(({ metadata, file }) => {
      return { url: file.ufsUrl, name: file.name, size: file.size, type: file.type, uploadedBy: metadata.userId }
    }),

  sellerDocument: f({
    "image/png": { maxFileSize: "8MB", maxFileCount: 1 },
    "image/jpeg": { maxFileSize: "8MB", maxFileCount: 1 },
    "image/webp": { maxFileSize: "8MB", maxFileCount: 1 },
    "application/pdf": { maxFileSize: "16MB", maxFileCount: 1 },
  })
    .middleware(authMiddleware)
    .onUploadComplete(({ metadata, file }) => {
      return {
        url: file.ufsUrl,
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedBy: metadata.userId,
      }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
