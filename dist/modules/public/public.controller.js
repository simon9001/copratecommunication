import { PublicService } from './public.service.js';
export class PublicController {
    /** GET /public/map?county=X&status=Y */
    static getMapProjects = async (c) => {
        const county = c.req.query('county') || undefined;
        const status = c.req.query('status') || undefined;
        const data = await PublicService.getMapProjects(county, status);
        return c.json({ success: true, data });
    };
    /** GET /public/counties/stats */
    static getCountyStats = async (c) => {
        const data = await PublicService.getCountyStats();
        return c.json({ success: true, data });
    };
    /** GET /public/projects/:id/route */
    static getProjectRoute = async (c) => {
        const id = Number(c.req.param('id'));
        if (!id || isNaN(id)) {
            return c.json({ success: false, error: 'Invalid project ID' }, 400);
        }
        const route = await PublicService.getProjectRoute(id);
        if (!route) {
            return c.json({ success: false, error: 'No route found for this project' }, 404);
        }
        return c.json({ success: true, data: route });
    };
    /** GET /public/routes — all project routes for map display */
    static getAllProjectRoutes = async (c) => {
        const data = await PublicService.getAllProjectRoutes();
        return c.json({ success: true, data });
    };
    /** GET /public/summary */
    static getProjectSummaries = async (c) => {
        const data = await PublicService.getProjectSummaries();
        return c.json({ success: true, data });
    };
}
