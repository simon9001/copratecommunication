import client, { Registry, Counter, Histogram, Gauge } from 'prom-client'

export class PrometheusService {
  public static registry = new Registry()

  // Standard Node process metrics
  public static initDefaultMetrics() {
    client.collectDefaultMetrics({ register: this.registry, prefix: 'kenha_vr_' })
  }

  // Custom HTTP Requests Counter
  public static httpRequestCounter = new Counter({
    name: 'kenha_vr_http_requests_total',
    help: 'Total number of HTTP requests processed by the API',
    labelNames: ['method', 'route', 'status_code'],
    registers: [PrometheusService.registry],
  })

  // Custom HTTP Request Duration Histogram
  public static httpRequestDurationHistogram = new Histogram({
    name: 'kenha_vr_http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [PrometheusService.registry],
  })

  // Custom Database Query Duration Histogram
  public static dbQueryDurationHistogram = new Histogram({
    name: 'kenha_vr_db_query_duration_seconds',
    help: 'Duration of SQL Server database queries in seconds',
    labelNames: ['operation'],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2],
    registers: [PrometheusService.registry],
  })

  // Database Connection Status Gauge (1 = healthy, 0 = unhealthy)
  public static dbConnectionGauge = new Gauge({
    name: 'kenha_vr_db_connection_status',
    help: 'Status of SQL Server Database connection (1 = healthy, 0 = unhealthy)',
    registers: [PrometheusService.registry],
  })

  // Cloudinary Connection Status Gauge (1 = connected, 0 = disconnected)
  public static cloudinaryConnectionGauge = new Gauge({
    name: 'kenha_vr_cloudinary_connection_status',
    help: 'Status of Cloudinary media service connection (1 = connected, 0 = disconnected)',
    registers: [PrometheusService.registry],
  })

  /**
   * Get all registered metrics formatted for Prometheus scraping
   */
  public static async getMetricsContentType(): Promise<string> {
    return this.registry.contentType
  }

  public static async getMetrics(): Promise<string> {
    return this.registry.metrics()
  }
}

// Initialize default metrics collection on module load
PrometheusService.initDefaultMetrics()
