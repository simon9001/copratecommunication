import { HealthService } from './health.service.js';
import { createSuccessResponse } from '../../errors/errorResponse.js';
export class HealthController {
    static async getHealth(c) {
        const healthResult = await HealthService.getHealthStatus();
        return c.json(createSuccessResponse(healthResult.data, 'System health check completed', undefined, c.get('requestId')), healthResult.statusCode);
    }
    static async getMetrics(c) {
        const { contentType, metricsText } = await HealthService.getPrometheusMetrics();
        return c.text(metricsText, 200, {
            'Content-Type': contentType,
        });
    }
}
