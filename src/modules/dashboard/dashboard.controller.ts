import type { Context } from 'hono'
import { DashboardService } from './dashboard.service.js'
import { createSuccessResponse } from '../../errors/errorResponse.js'

export class DashboardController {
  public static async getOverview(c: Context) {
    const overview = await DashboardService.getOverview()

    return c.json(
      createSuccessResponse(overview, 'Dashboard overview retrieved', undefined, c.get('requestId') as string | undefined)
    )
  }
}
