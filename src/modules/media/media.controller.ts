import type { Context } from 'hono'
import { MediaService } from './media.service.js'
import { createSuccessResponse } from '../../errors/errorResponse.js'
import type { CreateMediaDto } from './media.schema.js'

export interface UploadServerFileBody {
  projectId: number
  mediaType: string
  title?: string
  description?: string
  fileData: string
  isFeatured?: boolean
}

export class MediaController {
  public static async listAllMedia(c: Context) {
    const media = await MediaService.listAllMedia()
    return c.json(
      createSuccessResponse(media, 'Media items retrieved', undefined, c.get('requestId') as string | undefined)
    )
  }

  public static async createMedia(c: Context) {
    const user = c.get('user')
    const body = c.get('validatedBody') as CreateMediaDto
    const media = await MediaService.createMediaRecord(body, user.userId)
    return c.json(
      createSuccessResponse(media, 'Project media uploaded', undefined, c.get('requestId') as string | undefined),
      201
    )
  }

  public static async updateMedia(c: Context) {
    const paramId = c.req.param('mediaId') || ''
    const mediaId = parseInt(paramId, 10)
    const body = c.get('validatedBody')
    const media = await MediaService.updateMedia(mediaId, body)
    return c.json(
      createSuccessResponse(media, 'Media item updated', undefined, c.get('requestId') as string | undefined)
    )
  }

  public static async deleteMedia(c: Context) {
    const paramId = c.req.param('mediaId') || ''
    const mediaId = parseInt(paramId, 10)
    await MediaService.deleteMedia(mediaId)
    return c.json(
      createSuccessResponse(null, 'Media item deleted', undefined, c.get('requestId') as string | undefined)
    )
  }

  public static async getUploadSignature(c: Context) {
    const folder = c.req.query('folder') || 'kenha_vr_projects'
    const rt = c.req.query('resourceType')
    const resourceType = rt === 'video' || rt === 'image' ? rt : 'auto'
    const signatureData = await MediaService.generateCloudinarySignature(folder, resourceType)
    return c.json(
      createSuccessResponse(
        signatureData,
        'Cloudinary direct upload signature generated successfully',
        undefined,
        c.get('requestId') as string | undefined
      )
    )
  }

  public static async uploadToCloudinary(c: Context) {
    const user = c.get('user')
    const body = c.get('validatedBody') as UploadServerFileBody

    const result = await MediaService.uploadToCloudinaryAndSave(
      body.projectId,
      body.mediaType,
      body.fileData,
      body.title,
      body.description,
      body.isFeatured || false,
      user.userId
    )

    return c.json(
      createSuccessResponse(
        result,
        'Media uploaded to Cloudinary and registered in the database',
        undefined,
        c.get('requestId') as string | undefined
      ),
      201
    )
  }
}
