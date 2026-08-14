import { z } from 'zod';
import { publicationStatusEnum } from '../project/project.schema.js';
export const createProjectUpdateSchema = z.object({
    projectId: z.number().int(),
    title: z.string().min(2).max(250),
    content: z.string().min(2),
    progressPercentage: z.number().min(0).max(100).optional(),
    updateDate: z.string(),
    publicationStatus: publicationStatusEnum.default('Draft'),
});
export const updateProjectUpdateSchema = createProjectUpdateSchema.partial();
export const createMilestoneSchema = z.object({
    projectId: z.number().int(),
    title: z.string().min(2).max(250),
    description: z.string().optional(),
    milestoneDate: z.string().optional(),
    completionPercentage: z.number().min(0).max(100).optional(),
    status: z.string().default('Completed'),
});
export const updateMilestoneSchema = createMilestoneSchema.partial();
