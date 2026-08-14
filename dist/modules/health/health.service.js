import { checkDbHealth } from '../../db/connection.js';
import { CloudinaryService } from '../../services/cloudinary.service.js';
import { PrometheusService } from '../../services/prometheus.service.js';
export class HealthService {
    static async getHealthStatus() {
        const dbHealth = await checkDbHealth();
        const cloudinaryHealth = await CloudinaryService.checkCloudinaryHealth();
        const uptime = process.uptime();
        const memoryUsage = process.memoryUsage();
        // Update Prometheus Gauges
        PrometheusService.dbConnectionGauge.set(dbHealth.status === 'healthy' ? 1 : 0);
        PrometheusService.cloudinaryConnectionGauge.set(cloudinaryHealth.status === 'connected' ? 1 : 0);
        const isHealthy = dbHealth.status === 'healthy' && (cloudinaryHealth.status === 'connected' || cloudinaryHealth.status === 'unconfigured');
        const statusCode = isHealthy ? 200 : 503;
        return {
            statusCode,
            data: {
                status: isHealthy ? 'UP' : 'DEGRADED',
                timestamp: new Date().toISOString(),
                uptimeSeconds: Math.floor(uptime),
                services: {
                    database: dbHealth,
                    cloudinary: cloudinaryHealth,
                },
                memory: {
                    rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
                    heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
                    heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
                },
            },
        };
    }
    static async getPrometheusMetrics() {
        const contentType = await PrometheusService.getMetricsContentType();
        const metricsText = await PrometheusService.getMetrics();
        return { contentType, metricsText };
    }
}
