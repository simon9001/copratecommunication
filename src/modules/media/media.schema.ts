import { z } from 'zod'

export const mediaTypeEnum = z.enum(['VIDEO', 'IMAGE', '360_VIDEO', '360_IMAGE', 'MODEL_3D'])
export const mediaApprovalEnum = z.enum(['Draft', 'Pending Review', 'Approved', 'Rejected', 'Published', 'Archived'])

export const createMediaSchema = z.object({
  projectId: z.number().int(),
  mediaType: mediaTypeEnum,
  title: z.string().max(250).optional(),
  description: z.string().max(1000).optional(),
  mediaUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  durationSeconds: z.number().int().optional(),
  fileSizeBytes: z.number().int().optional(),
  mimeType: z.string().max(100).optional(),
  approvalStatus: mediaApprovalEnum.default('Draft'),
  displayOrder: z.number().int().default(0),
  isFeatured: z.boolean().default(false),
  isPublished: z.boolean().default(false),
})

export const updateMediaSchema = createMediaSchema.partial()

export type CreateMediaDto = z.infer<typeof createMediaSchema>
export type UpdateMediaDto = z.infer<typeof updateMediaSchema>
