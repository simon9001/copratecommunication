import { MediaService } from './media.service.js';
import { createSuccessResponse } from '../../errors/errorResponse.js';
export class MediaController {
    static async listAllMedia(c) {
        const media = await MediaService.listAllMedia();
        return c.json(createSuccessResponse(media, 'Media items retrieved', undefined, c.get('requestId')));
    }
    static async createMedia(c) {
        const user = c.get('user');
        const body = c.get('validatedBody');
        const media = await MediaService.createMediaRecord(body, user.userId);
        return c.json(createSuccessResponse(media, 'Project media uploaded', undefined, c.get('requestId')), 201);
    }
    static async deleteMedia(c) {
        const paramId = c.req.param('mediaId') || '';
        const mediaId = parseInt(paramId, 10);
        await MediaService.deleteMedia(mediaId);
        return c.json(createSuccessResponse(null, 'Media item deleted', undefined, c.get('requestId')));
    }
    static async getUploadSignature(c) {
        const folder = c.req.query('folder') || 'kenha_vr_projects';
        const signatureData = await MediaService.generateCloudinarySignature(folder);
        return c.json(createSuccessResponse(signatureData, 'Cloudinary direct upload signature generated successfully', undefined, c.get('requestId')));
    }
    static async uploadToCloudinary(c) {
        const user = c.get('user');
        const body = c.get('validatedBody');
        const result = await MediaService.uploadToCloudinaryAndSave(body.projectId, body.mediaType, body.fileData, body.title, body.description, body.isFeatured || false, user.userId);
        return c.json(createSuccessResponse(result, 'Media uploaded to Cloudinary and registered in SQL Server', undefined, c.get('requestId')), 201);
    }
}
