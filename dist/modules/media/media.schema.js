import { z } from 'zod';
export const mediaTypeEnum = z.enum(['VIDEO', 'IMAGE', '360_VIDEO', '360_IMAGE', 'MODEL_3D']);
export const mediaApprovalEnum = z.enum(['Draft', 'Pending Review', 'Approved', 'Rejected', 'Published', 'Archived']);
export const createMediaSchema = z.object({
    projectId: z.number().int(),
    mediaType: mediaTypeEnum,
    title: z.string().max(250).optional(),
    description: z.string().max(1000).optional(),
    mediaUrl: z.string().min(1, 'Media URL or file data is required'),
    thumbnailUrl: z.string().optional().nullable(),
    durationSeconds: z.number().int().optional(),
    fileSizeBytes: z.number().int().optional(),
    mimeType: z.string().max(100).optional(),
    approvalStatus: mediaApprovalEnum.default('Approved'),
    displayOrder: z.number().int().default(0),
    isFeatured: z.boolean().default(false),
    isPublished: z.boolean().default(true),
});
export const updateMediaSchema = createMediaSchema.partial();
