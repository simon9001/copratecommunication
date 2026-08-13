import { createMiddleware } from 'hono/factory'
import { logger } from '../services/logger.service.js'
import { PrometheusService } from '../services/prometheus.service.js'

export const loggerMiddleware = createMiddleware<{
  Variables: {
    requestId: string
  }
}>(async (c, next) => {
  const start = Date.now()
  const method = c.req.method
  const path = c.req.path
  const requestId = c.get('requestId') || 'N/A'

  logger.info(`--> ${method} ${path} [ReqID: ${requestId}]`)

  await next()

  const durationMs = Date.now() - start
  const durationSec = durationMs / 1000
  const status = c.res.status.toString()

  // Track Prometheus HTTP Metrics
  PrometheusService.httpRequestCounter.inc({ method, route: path, status_code: status })
  PrometheusService.httpRequestDurationHistogram.observe({ method, route: path, status_code: status }, durationSec)

  if (c.res.status >= 500) {
    logger.error(`<-- ${method} ${path} ${status} - ${durationMs}ms [ReqID: ${requestId}]`)
  } else if (c.res.status >= 400) {
    logger.warn(`<-- ${method} ${path} ${status} - ${durationMs}ms [ReqID: ${requestId}]`)
  } else {
    logger.info(`<-- ${method} ${path} ${status} - ${durationMs}ms [ReqID: ${requestId}]`)
  }
})
