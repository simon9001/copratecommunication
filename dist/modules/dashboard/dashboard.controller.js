import { DashboardService } from './dashboard.service.js';
import { createSuccessResponse } from '../../errors/errorResponse.js';
export class DashboardController {
    static async getOverview(c) {
        const overview = await DashboardService.getOverview();
        return c.json(createSuccessResponse(overview, 'Dashboard overview retrieved', undefined, c.get('requestId')));
    }
}
