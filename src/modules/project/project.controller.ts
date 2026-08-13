import type { Context } from 'hono'
import { ProjectService } from './project.service.js'
import { createSuccessResponse } from '../../errors/errorResponse.js'
import type {
  CreateProjectDto,
  ProjectQueryDto,
  UpdateProjectDto,
  UpdateProjectStatusDto,
} from './project.schema.js'

export class ProjectController {
  public static async listProjects(c: Context) {
    const queryDto = c.get('validatedQuery') as ProjectQueryDto
    const result = await ProjectService.listProjects(queryDto)

    return c.json(
      createSuccessResponse(
        result.items,
        'Projects list retrieved',
        result.pagination,
        c.get('requestId') as string | undefined
      )
    )
  }

  public static async getProjectById(c: Context) {
    const paramId = c.req.param('id') || ''
    const id = parseInt(paramId, 10)
    const project = await ProjectService.getProjectById(id)

    return c.json(
      createSuccessResponse(project, 'Project details retrieved', undefined, c.get('requestId') as string | undefined)
    )
  }

  public static async getProjectBySlug(c: Context) {
    const slug = c.req.param('slug') || ''
    const project = await ProjectService.getProjectBySlug(slug)

    return c.json(
      createSuccessResponse(project, 'Project details retrieved', undefined, c.get('requestId') as string | undefined)
    )
  }

  public static async createProject(c: Context) {
    const user = c.get('user')
    const body = c.get('validatedBody') as CreateProjectDto
    const created = await ProjectService.createProject(body, user.userId)

    return c.json(
      createSuccessResponse(created, 'Project created successfully', undefined, c.get('requestId') as string | undefined),
      201
    )
  }

  public static async updateProject(c: Context) {
    const paramId = c.req.param('id') || ''
    const id = parseInt(paramId, 10)
    const user = c.get('user')
    const body = c.get('validatedBody') as UpdateProjectDto
    const updated = await ProjectService.updateProject(id, body, user.userId)

    return c.json(
      createSuccessResponse(updated, 'Project updated successfully', undefined, c.get('requestId') as string | undefined)
    )
  }

  public static async updatePublicationStatus(c: Context) {
    const paramId = c.req.param('id') || ''
    const id = parseInt(paramId, 10)
    const user = c.get('user')
    const body = c.get('validatedBody') as UpdateProjectStatusDto
    const updated = await ProjectService.updatePublicationStatus(id, body, user.userId)

    return c.json(
      createSuccessResponse(
        updated,
        `Project publication status updated to '${body.publicationStatus}'`,
        undefined,
        c.get('requestId') as string | undefined
      )
    )
  }

  public static async deleteProject(c: Context) {
    const paramId = c.req.param('id') || ''
    const id = parseInt(paramId, 10)
    const user = c.get('user')
    await ProjectService.deleteProject(id, user.userId)

    return c.json(
      createSuccessResponse(null, `Project ${id} deleted successfully`, undefined, c.get('requestId') as string | undefined)
    )
  }
}
