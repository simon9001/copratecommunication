import { Hono } from 'hono';
import { HealthController } from './health.controller.js';
export const healthRouter = new Hono();
healthRouter.get('/', HealthController.getHealth);
healthRouter.get('/metrics', HealthController.getMetrics);
