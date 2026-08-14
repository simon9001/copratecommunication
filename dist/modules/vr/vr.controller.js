import { VRService } from './vr.service.js';
import { createSuccessResponse } from '../../errors/errorResponse.js';
export class VRController {
    static async getVRDetails(c) {
        const paramId = c.req.param('projectId') || '';
        const projectId = parseInt(paramId, 10);
        const result = await VRService.getVRDetails(projectId);
        return c.json(createSuccessResponse(result, 'VR settings retrieved', undefined, c.get('requestId')));
    }
    static async updateVRSettings(c) {
        const paramId = c.req.param('projectId') || '';
        const projectId = parseInt(paramId, 10);
        const body = await c.req.json();
        const updated = await VRService.updateVRSettings(projectId, body);
        return c.json(createSuccessResponse(updated, 'VR settings updated', undefined, c.get('requestId')));
    }
}
