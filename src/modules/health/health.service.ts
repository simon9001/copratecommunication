import { checkDbHealth } from '../../db/connection.js'
import { CloudinaryService } from '../../services/cloudinary.service.js'
import { PrometheusService } from '../../services/prometheus.service.js'
import { checkSupabaseHealth } from '../../services/supabase.service.js'

export class HealthService {
  public static async getHealthStatus() {
    const dbHealth = await checkDbHealth()
    const cloudinaryHealth = await CloudinaryService.checkCloudinaryHealth()
    const supabaseHealth = await checkSupabaseHealth()

    const uptime = process.uptime()
    const memoryUsage = process.memoryUsage()

    // Update Prometheus Gauges
    PrometheusService.dbConnectionGauge.set(dbHealth.status === 'healthy' ? 1 : 0)
    PrometheusService.cloudinaryConnectionGauge.set(cloudinaryHealth.status === 'connected' ? 1 : 0)

    const isHealthy = dbHealth.status === 'healthy' && (cloudinaryHealth.status === 'connected' || cloudinaryHealth.status === 'unconfigured')
    const statusCode = isHealthy ? 200 : 503

    return {
      statusCode,
      data: {
        status: isHealthy ? 'UP' : 'DEGRADED',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(uptime),
        services: {
          database: dbHealth,
          cloudinary: cloudinaryHealth,
          // This endpoint is public, so only the status and latency are
          // reported here — never the key, and never the project ref.
          supabaseStorage: {
            status: supabaseHealth.status,
            latencyMs: supabaseHealth.latencyMs,
          },
        },
        memory: {
          rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
          heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        },
      },
    }
  }

  public static async getPrometheusMetrics() {
    const contentType = await PrometheusService.getMetricsContentType()
    const metricsText = await PrometheusService.getMetrics()
    return { contentType, metricsText }
  }
}
