import type { Context } from 'hono'
import { UpdateService } from './update.service.js'
import { createSuccessResponse } from '../../errors/errorResponse.js'
import type { CreateProjectUpdateDto, CreateMilestoneDto } from './update.schema.js'

export class UpdateController {
  public static async createUpdate(c: Context) {
    const user = c.get('user')
    const body = c.get('validatedBody') as CreateProjectUpdateDto
    const updateRecord = await UpdateService.createUpdate(body, user.userId)
    return c.json(
      createSuccessResponse(updateRecord, 'Project update added', undefined, c.get('requestId') as string | undefined),
      201
    )
  }

  public static async createMilestone(c: Context) {
    const body = c.get('validatedBody') as CreateMilestoneDto
    const milestone = await UpdateService.createMilestone(body)
    return c.json(
      createSuccessResponse(milestone, 'Project milestone created', undefined, c.get('requestId') as string | undefined),
      201
    )
  }
}
