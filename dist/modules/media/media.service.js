import { MediaRepository } from './media.repository.js';
import { CloudinaryService } from '../../services/cloudinary.service.js';
export class MediaService {
    static async listAllMedia() {
        return MediaRepository.findAll();
    }
    static async getMediaByProject(projectId) {
        return MediaRepository.findByProjectId(projectId);
    }
    static async createMediaRecord(dto, userId) {
        return MediaRepository.create(dto, userId);
    }
    static async updateMedia(mediaId, dto) {
        return MediaRepository.update(mediaId, dto);
    }
    static async deleteMedia(mediaId) {
        return MediaRepository.delete(mediaId);
    }
    static async generateCloudinarySignature(folder = 'kenha_vr_projects') {
        return CloudinaryService.generateUploadSignature(folder);
    }
    static async uploadToCloudinaryAndSave(projectId, mediaType, fileData, title, description, isFeatured = false, userId = null) {
        const resourceType = mediaType.includes('VIDEO') ? 'video' : mediaType.includes('IMAGE') ? 'image' : 'auto';
        const cloudinaryRes = await CloudinaryService.uploadFile(fileData, `projects/${projectId}`, resourceType);
        const mediaRecord = await MediaRepository.create({
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
        }, userId);
        return {
            media: mediaRecord,
            cloudinary: {
                publicId: cloudinaryRes.public_id,
                format: cloudinaryRes.format,
                bytes: cloudinaryRes.bytes,
                secureUrl: cloudinaryRes.secure_url,
            },
        };
    }
}
