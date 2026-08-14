import { LocationService } from './location.service.js';
import { createSuccessResponse } from '../../errors/errorResponse.js';
export class LocationController {
    static async createLocation(c) {
        const body = c.get('validatedBody');
        const location = await LocationService.createLocation(body);
        return c.json(createSuccessResponse(location, 'Project location added', undefined, c.get('requestId')), 201);
    }
    static async deleteLocation(c) {
        const paramId = c.req.param('locationId') || '';
        const locationId = parseInt(paramId, 10);
        await LocationService.deleteLocation(locationId);
        return c.json(createSuccessResponse(null, 'Location deleted', undefined, c.get('requestId')));
    }
}
