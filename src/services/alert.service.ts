import { env } from '../config/env.js'
import { logger } from './logger.service.js'

export interface AlertPayload {
  severity: 'WARNING' | 'CRITICAL' | 'FATAL'
  title: string
  message: string
  details?: unknown
  requestId?: string
  timestamp?: string
}

class AlertService {
  private alertHistory: Map<string, number> = new Map() // Rate limit map: alertKey -> lastSentTime
  private alertCooldownMs = 60000 // 1 minute rate limit per unique alert key

  public async triggerAlert(payload: AlertPayload): Promise<void> {
    const alertKey = `${payload.severity}:${payload.title}`
    const now = Date.now()
    const lastSent = this.alertHistory.get(alertKey)

    // Deduplicate alerts within cooldown window
    if (lastSent && now - lastSent < this.alertCooldownMs) {
      logger.debug(`[Alert Suppressed] Alert '${alertKey}' suppressed due to rate limit cooldown.`)
      return
    }

    this.alertHistory.set(alertKey, now)

    const formattedAlert = {
      ...payload,
      timestamp: payload.timestamp || new Date().toISOString(),
      environment: env.NODE_ENV,
      system: 'KeNHA VR Projects Backend',
    }

    // 1. Console Alert Banner
    console.error('\n===================================================================')
    console.error(`🚨 [SYSTEM ALERT - ${payload.severity}] ${payload.title}`)
    console.error(`Message: ${payload.message}`)
    if (payload.requestId) console.error(`Request ID: ${payload.requestId}`)
    if (payload.details) console.error(`Details:`, payload.details)
    console.error('===================================================================\n')

    // 2. Webhook Notification (Slack / Discord / Custom Endpoint) if configured
    if (env.ALERT_WEBHOOK_URL) {
      try {
        await fetch(env.ALERT_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 *[${payload.severity}] ${payload.title}*\n>${payload.message}\n\`\`\`json\n${JSON.stringify(
              formattedAlert,
              null,
              2
            )}\n\`\`\``,
          }),
        })
        logger.info(`[Alert Dispatched] Webhook alert successfully sent to configured endpoint.`)
      } catch (err) {
        logger.error(`[Alert Dispatch Failed] Could not deliver webhook alert:`, err)
      }
    }
  }
}

export const alertService = new AlertService()
