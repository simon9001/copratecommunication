import type { Context } from 'hono'
import { HealthService } from './health.service.js'
import { createSuccessResponse } from '../../errors/errorResponse.js'

export class HealthController {
  public static async getHealth(c: Context) {
    const healthResult = await HealthService.getHealthStatus()
    return c.json(
      createSuccessResponse(healthResult.data, 'System health check completed', undefined, c.get('requestId') as string | undefined),
      healthResult.statusCode as any
    )
  }

  public static async getMetrics(c: Context) {
    const { contentType, metricsText } = await HealthService.getPrometheusMetrics()
    return c.text(metricsText, 200, {
      'Content-Type': contentType,
    })
  }
}
