import { UpdateService } from './update.service.js';
import { createSuccessResponse } from '../../errors/errorResponse.js';
export class UpdateController {
    static async createUpdate(c) {
        const user = c.get('user');
        const body = c.get('validatedBody');
        const updateRecord = await UpdateService.createUpdate(body, user.userId);
        return c.json(createSuccessResponse(updateRecord, 'Project update added', undefined, c.get('requestId')), 201);
    }
    static async createMilestone(c) {
        const body = c.get('validatedBody');
        const milestone = await UpdateService.createMilestone(body);
        return c.json(createSuccessResponse(milestone, 'Project milestone created', undefined, c.get('requestId')), 201);
    }
}
