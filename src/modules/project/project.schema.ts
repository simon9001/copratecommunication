import { z } from 'zod'

export const projectStatusEnum = z.enum(['Planned', 'Ongoing', 'Completed', 'Suspended', 'Cancelled'])
export const publicationStatusEnum = z.enum(['Draft', 'Pending Review', 'Changes Requested', 'Approved', 'Published', 'Archived'])

export const createProjectSchema = z.object({
  projectCode: z.string().min(2).max(50),
  projectName: z.string().min(2).max(250),
  slug: z.string().min(2).max(250).optional(),
  shortDescription: z.string().max(1000).optional(),
  fullDescription: z.string().optional(),
  projectStatus: projectStatusEnum.default('Planned'),
  publicationStatus: publicationStatusEnum.default('Draft'),
  startDate: z.string().optional(),
  expectedCompletionDate: z.string().optional(),
  completionDate: z.string().optional(),
  projectCost: z.number().positive().optional(),
  currencyCode: z.string().length(3).default('KES'),
  lengthKm: z.number().positive().optional(),
  isFeatured: z.boolean().default(false),
  isPublished: z.boolean().default(false),
  categoryIds: z.array(z.number().int()).optional(),
})

export const updateProjectSchema = createProjectSchema.partial()

export const updateProjectStatusSchema = z.object({
  publicationStatus: publicationStatusEnum,
  comment: z.string().max(2000).optional(),
})

export const projectQuerySchema = z.object({
  search: z.string().optional(),
  projectStatus: projectStatusEnum.optional(),
  publicationStatus: publicationStatusEnum.optional(),
  county: z.string().optional(),
  category: z.string().optional(),
  isFeatured: z.string().transform((val) => val === 'true').optional(),
  isPublished: z.string().transform((val) => val === 'true').optional(),
  page: z.string().default('1').transform((val) => Math.max(1, parseInt(val, 10))),
  limit: z.string().default('10').transform((val) => Math.min(100, Math.max(1, parseInt(val, 10)))),
})

export type CreateProjectDto = z.infer<typeof createProjectSchema>
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>
export type UpdateProjectStatusDto = z.infer<typeof updateProjectStatusSchema>
export type ProjectQueryDto = z.infer<typeof projectQuerySchema>
