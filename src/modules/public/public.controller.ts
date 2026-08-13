import type { Context } from 'hono'
import { PublicService } from './public.service.js'
import { createSuccessResponse } from '../../errors/errorResponse.js'

export class PublicController {
  public static async getMapProjects(c: Context) {
    const mapData = await PublicService.getMapProjects()
    return c.json(
      createSuccessResponse(mapData, 'Public project map data retrieved', undefined, c.get('requestId') as string | undefined)
    )
  }

  public static async getProjectSummaries(c: Context) {
    const summaryData = await PublicService.getProjectSummaries()
    return c.json(
      createSuccessResponse(summaryData, 'Public project summaries retrieved', undefined, c.get('requestId') as string | undefined)
    )
  }
}
