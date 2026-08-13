import type { Context } from 'hono'
import { MediaService } from './media.service.js'
import { createSuccessResponse } from '../../errors/errorResponse.js'
import type { CreateMediaDto } from './media.schema.js'

export interface UploadServerFileBody {
  projectId: number
  mediaType: 'VIDEO' | 'IMAGE' | '360_VIDEO' | '360_IMAGE' | 'MODEL_3D'
  title?: string
  description?: string
  fileData: string
  isFeatured?: boolean
}

export class MediaController {
  public static async createMedia(c: Context) {
    const user = c.get('user')
    const body = c.get('validatedBody') as CreateMediaDto
    const media = await MediaService.createMediaRecord(body, user.userId)
    return c.json(
      createSuccessResponse(media, 'Project media uploaded', undefined, c.get('requestId') as string | undefined),
      201
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
    const signatureData = await MediaService.generateCloudinarySignature(folder)
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
        'Media uploaded to Cloudinary and registered in SQL Server',
        undefined,
        c.get('requestId') as string | undefined
      ),
      201
    )
  }
}
