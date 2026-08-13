import { z } from 'zod'

export const createLocationSchema = z.object({
  projectId: z.number().int(),
  locationName: z.string().max(250).optional(),
  county: z.string().min(2).max(100),
  subCounty: z.string().max(100).optional(),
  ward: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  isPrimaryLocation: z.boolean().default(true),
})

export const updateLocationSchema = createLocationSchema.partial()

export type CreateLocationDto = z.infer<typeof createLocationSchema>
export type UpdateLocationDto = z.infer<typeof updateLocationSchema>
