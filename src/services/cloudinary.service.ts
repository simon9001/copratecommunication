import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary'
import { env } from '../config/env.js'
import { BadRequestError, InternalServerError } from '../errors/AppError.js'
import { logger } from './logger.service.js'

// Initialize Cloudinary SDK
if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  })
  logger.info(`[Cloudinary] SDK configured for cloud '${env.CLOUDINARY_CLOUD_NAME}'`)
} else {
  logger.warn('[Cloudinary] Missing Cloudinary credentials in .env. Cloudinary features will run in unconfigured mode.')
}

export interface CloudinarySignaturePayload {
  timestamp: number
  signature: string
  apiKey: string
  cloudName: string
  uploadPreset?: string
  folder: string
  tags?: string
  eager?: string
  eager_async?: boolean
}

/**
 * Derived renditions requested at upload time for every video.
 *
 * Building these eagerly matters: a 300-500 MB master transcoded on demand means
 * the first viewer's request blocks (and frequently times out) while Cloudinary
 * encodes. `eager_async` moves that work off the upload response, so the
 * renditions are ready before anyone opens the project page.
 *
 *   sp_auto - adaptive-bitrate HLS ladder, the primary playback path
 *   1280p   - progressive MP4 fallback for players without MSE
 *   960 eco - lightweight muted loop used behind hero sections
 */
const VIDEO_EAGER_TRANSFORMS = [
  'sp_auto',
  'f_mp4,vc_auto,q_auto,w_1280,c_limit,ac_aac',
  'f_mp4,vc_auto,q_auto:eco,w_960,c_limit,br_900k,ac_none',
]

export interface CloudinaryHealthResult {
  status: 'connected' | 'disconnected' | 'unconfigured'
  latencyMs: number
  cloudName: string
  error?: string
}

export class CloudinaryService {
  /**
   * Health probe verifying Cloudinary API connectivity
   */
  public static async checkCloudinaryHealth(): Promise<CloudinaryHealthResult> {
    const cloudName = env.CLOUDINARY_CLOUD_NAME || 'unconfigured'
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
      return {
        status: 'unconfigured',
        latencyMs: 0,
        cloudName,
        error: 'Missing Cloudinary configuration credentials in environment variables',
      }
    }

    const start = Date.now()
    try {
      const result = await cloudinary.api.ping()
      const latencyMs = Date.now() - start
      if (result.status === 'ok') {
        return { status: 'connected', latencyMs, cloudName }
      }
      return { status: 'disconnected', latencyMs, cloudName, error: `Unexpected ping response status: ${result.status}` }
    } catch (err: any) {
      const latencyMs = Date.now() - start
      logger.error('[Cloudinary Health Check Failed]', err)
      return { status: 'disconnected', latencyMs, cloudName, error: err?.message || 'Cloudinary API ping failed' }
    }
  }

  /**
   * Upload base64 or buffer directly to Cloudinary
   */
  public static async uploadFile(
    fileData: string,
    folder: string = 'kenha_vr_projects',
    resourceType: 'image' | 'video' | 'auto' | 'raw' = 'auto'
  ): Promise<UploadApiResponse> {
    try {
      const isVideo = resourceType === 'video'
      const result = await cloudinary.uploader.upload(fileData, {
        folder,
        resource_type: resourceType,
        // Large masters must go through the chunked endpoint or the upload itself
        // times out well before any playback concern.
        ...(isVideo
          ? {
              chunk_size: 20_000_000,
              eager: VIDEO_EAGER_TRANSFORMS.map((transformation) => ({ raw_transformation: transformation })),
              eager_async: true,
            }
          : {}),
      })
      logger.info(`[Cloudinary Upload Success] Public ID: ${result.public_id}, URL: ${result.secure_url}`)
      return result
    } catch (err: any) {
      logger.error('[Cloudinary Upload Error]', err)
      throw new InternalServerError(`Cloudinary media upload failed: ${err?.message || err}`)
    }
  }

  /**
   * Generate signed parameters for direct client upload
   */
  public static generateUploadSignature(
    folder: string = 'kenha_vr_projects',
    tags: string[] = ['kenha'],
    resourceType: 'image' | 'video' | 'auto' = 'auto'
  ): CloudinarySignaturePayload {
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
      throw new BadRequestError('Cloudinary is not properly configured in server environment variables')
    }

    const timestamp = Math.round(new Date().getTime() / 1000)
    const tagsStr = tags.join(',')
    const paramsToSign: Record<string, any> = {
      timestamp,
      folder,
      tags: tagsStr,
    }

    // Videos uploaded straight from the browser get the same eager ladder as
    // server-side uploads. Every signed parameter must also be sent by the client
    // verbatim, so these travel back in the payload below.
    const isVideo = resourceType === 'video'
    const eager = isVideo ? VIDEO_EAGER_TRANSFORMS.join('|') : undefined
    if (eager) {
      paramsToSign.eager = eager
      paramsToSign.eager_async = true
    }

    if (env.CLOUDINARY_UPLOAD_PRESET) {
      paramsToSign.upload_preset = env.CLOUDINARY_UPLOAD_PRESET
    }

    const signature = cloudinary.utils.api_sign_request(paramsToSign, env.CLOUDINARY_API_SECRET)

    return {
      timestamp,
      signature,
      apiKey: env.CLOUDINARY_API_KEY,
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      uploadPreset: env.CLOUDINARY_UPLOAD_PRESET,
      folder,
      tags: tagsStr,
      ...(eager ? { eager, eager_async: true } : {}),
    }
  }

  /**
   * Delete asset from Cloudinary by public ID
   */
  public static async deleteMedia(publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image'): Promise<boolean> {
    try {
      const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType })
      logger.info(`[Cloudinary Delete] Asset ${publicId} deletion result: ${result.result}`)
      return result.result === 'ok'
    } catch (err: any) {
      logger.error(`[Cloudinary Delete Error] Failed to delete ${publicId}:`, err)
      return false
    }
  }

  /**
   * Generate auto-optimized image/video URL
   */
  public static getOptimizedUrl(publicId: string, options: { width?: number; height?: number; crop?: string } = {}): string {
    return cloudinary.url(publicId, {
      fetch_format: 'auto',
      quality: 'auto',
      secure: true,
      ...options,
    })
  }
}
