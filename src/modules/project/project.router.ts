import { Hono } from 'hono'
import { ProjectController } from './project.controller.js'
import { LocationController } from '../location/location.controller.js'
import { MediaController } from '../media/media.controller.js'
import { UpdateController } from '../update/update.controller.js'
import { VRController } from '../vr/vr.controller.js'
import { authMiddleware } from '../../middleware/auth.middleware.js'
import { requireEditor } from '../../middleware/permission.middleware.js'
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js'
import type { AppEnv } from '../../types/hono.js'
import {
  createProjectSchema,
  projectQuerySchema,
  updateProjectSchema,
  updateProjectStatusSchema,
} from './project.schema.js'
import { createLocationSchema } from '../location/location.schema.js'
import { createMediaSchema } from '../media/media.schema.js'
import { createMilestoneSchema, createProjectUpdateSchema } from '../update/update.schema.js'

export const projectRouter = new Hono<AppEnv>()

// Projects
projectRouter.get('/', validateQuery(projectQuerySchema), ProjectController.listProjects)
projectRouter.get('/:id', ProjectController.getProjectById)
projectRouter.get('/slug/:slug', ProjectController.getProjectBySlug)
projectRouter.post('/', authMiddleware, requireEditor, validateBody(createProjectSchema), ProjectController.createProject)
projectRouter.put('/:id', authMiddleware, requireEditor, validateBody(updateProjectSchema), ProjectController.updateProject)
projectRouter.patch('/:id/status', authMiddleware, requireEditor, validateBody(updateProjectStatusSchema), ProjectController.updatePublicationStatus)
projectRouter.delete('/:id', authMiddleware, requireEditor, ProjectController.deleteProject)

// Locations
projectRouter.post('/:projectId/locations', authMiddleware, requireEditor, validateBody(createLocationSchema), LocationController.createLocation)
projectRouter.delete('/:projectId/locations/:locationId', authMiddleware, requireEditor, LocationController.deleteLocation)

// Media
projectRouter.post('/:projectId/media', authMiddleware, requireEditor, validateBody(createMediaSchema), MediaController.createMedia)
projectRouter.delete('/:projectId/media/:mediaId', authMiddleware, requireEditor, MediaController.deleteMedia)

// Updates & Milestones
projectRouter.post('/:projectId/updates', authMiddleware, requireEditor, validateBody(createProjectUpdateSchema), UpdateController.createUpdate)
projectRouter.post('/:projectId/milestones', authMiddleware, requireEditor, validateBody(createMilestoneSchema), UpdateController.createMilestone)

// VR Settings & Hotspots
projectRouter.get('/:projectId/vr-settings', VRController.getVRDetails)
projectRouter.put('/:projectId/vr-settings', authMiddleware, requireEditor, VRController.updateVRSettings)
