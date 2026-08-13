import { Hono } from 'hono'
import { HealthController } from './health.controller.js'
import type { AppEnv } from '../../types/hono.js'

export const healthRouter = new Hono<AppEnv>()

healthRouter.get('/', HealthController.getHealth)
healthRouter.get('/metrics', HealthController.getMetrics)
