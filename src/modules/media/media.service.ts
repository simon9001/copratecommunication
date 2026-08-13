import { MediaRepository } from './media.repository.js'
import { CloudinaryService } from '../../services/cloudinary.service.js'
import type { CreateMediaDto, UpdateMediaDto } from './media.schema.js'

export class MediaService {
  public static async getMediaByProject(projectId: number) {
    return MediaRepository.findByProjectId(projectId)
  }

  public static async createMediaRecord(dto: CreateMediaDto, userId: number | null) {
    return MediaRepository.create(dto, userId)
  }

  public static async updateMedia(mediaId: number, dto: UpdateMediaDto) {
    return MediaRepository.update(mediaId, dto)
  }

  public static async deleteMedia(mediaId: number) {
    return MediaRepository.delete(mediaId)
  }

  public static async generateCloudinarySignature(folder: string = 'kenha_vr_projects') {
    return CloudinaryService.generateUploadSignature(folder)
  }

  public static async uploadToCloudinaryAndSave(
    projectId: number,
    mediaType: 'VIDEO' | 'IMAGE' | '360_VIDEO' | '360_IMAGE' | 'MODEL_3D',
    fileData: string,
    title?: string,
    description?: string,
    isFeatured: boolean = false,
    userId: number | null = null
  ) {
    const resourceType = mediaType.includes('VIDEO') ? 'video' : 'image'
    const cloudinaryRes = await CloudinaryService.uploadFile(fileData, `projects/${projectId}`, resourceType)

    const mediaRecord = await MediaRepository.create(
      {
        projectId,
        mediaType,
        title: title || cloudinaryRes.original_filename,
        description,
        mediaUrl: cloudinaryRes.secure_url,
        thumbnailUrl: resourceType === 'video' ? cloudinaryRes.secure_url.replace(/\.[^/.]+$/, '.jpg') : cloudinaryRes.secure_url,
        durationSeconds: cloudinaryRes.duration ? Math.round(cloudinaryRes.duration) : undefined,
        fileSizeBytes: cloudinaryRes.bytes,
        mimeType: `${cloudinaryRes.resource_type}/${cloudinaryRes.format}`,
        approvalStatus: 'Draft',
        displayOrder: 0,
        isFeatured,
        isPublished: false,
      },
      userId
    )

    return {
      media: mediaRecord,
      cloudinary: {
        publicId: cloudinaryRes.public_id,
        format: cloudinaryRes.format,
        bytes: cloudinaryRes.bytes,
        secureUrl: cloudinaryRes.secure_url,
      },
    }
  }
}
