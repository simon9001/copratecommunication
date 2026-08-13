import { Hono } from 'hono'
import { PublicController } from './public.controller.js'
import type { AppEnv } from '../../types/hono.js'

export const publicRouter = new Hono<AppEnv>()

publicRouter.get('/map', PublicController.getMapProjects)
publicRouter.get('/summary', PublicController.getProjectSummaries)
