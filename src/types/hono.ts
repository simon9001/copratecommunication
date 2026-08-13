import type { JwtPayload } from '../services/auth.service.js'

export type AppEnv = {
  Variables: {
    requestId: string
    user: JwtPayload
    validatedBody: any
    validatedQuery: any
    validatedParam: any
  }
}
