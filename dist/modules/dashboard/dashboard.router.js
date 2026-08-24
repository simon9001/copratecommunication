import { Hono } from 'hono';
import { DashboardController } from './dashboard.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireEditor } from '../../middleware/permission.middleware.js';
export const dashboardRouter = new Hono();
dashboardRouter.get('/overview', authMiddleware, requireEditor, DashboardController.getOverview);
