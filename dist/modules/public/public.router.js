import { Hono } from 'hono';
import { PublicController } from './public.controller.js';
export const publicRouter = new Hono();
// Map projects (supports ?county=X&status=Y query params)
publicRouter.get('/map', PublicController.getMapProjects);
// Per-county project statistics
publicRouter.get('/counties/stats', PublicController.getCountyStats);
// All project routes (GeoJSON linestrings)
publicRouter.get('/routes', PublicController.getAllProjectRoutes);
// Single project route
publicRouter.get('/projects/:id/route', PublicController.getProjectRoute);
// Legacy summary endpoint
publicRouter.get('/summary', PublicController.getProjectSummaries);
