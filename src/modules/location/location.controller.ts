import type { Context } from 'hono'
import { LocationService } from './location.service.js'
import { createSuccessResponse } from '../../errors/errorResponse.js'
import type { CreateLocationDto } from './location.schema.js'

export class LocationController {
  public static async createLocation(c: Context) {
    const body = c.get('validatedBody') as CreateLocationDto
    const location = await LocationService.createLocation(body)
    return c.json(
      createSuccessResponse(location, 'Project location added', undefined, c.get('requestId') as string | undefined),
      201
    )
  }

  public static async deleteLocation(c: Context) {
    const paramId = c.req.param('locationId') || ''
    const locationId = parseInt(paramId, 10)
    await LocationService.deleteLocation(locationId)
    return c.json(
      createSuccessResponse(null, 'Location deleted', undefined, c.get('requestId') as string | undefined)
    )
  }
}
