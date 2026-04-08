import { createRouteHandler } from "uploadthing/next"
import { ourFileRouter } from "./core"

const callbackUrl = process.env.UPLOADTHING_CALLBACK_URL?.trim()

export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
  config: {
    token: process.env.UPLOADTHING_TOKEN,
    ...(callbackUrl ? { callbackUrl } : {}),
  },
})
