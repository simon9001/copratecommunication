import { Hono } from 'hono';
import { ProjectController } from './project.controller.js';
import { LocationController } from '../location/location.controller.js';
import { MediaController } from '../media/media.controller.js';
import { UpdateController } from '../update/update.controller.js';
import { VRController } from '../vr/vr.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import { createProjectSchema, projectQuerySchema, updateProjectSchema, updateProjectStatusSchema, } from './project.schema.js';
import { createLocationSchema } from '../location/location.schema.js';
import { createMediaSchema } from '../media/media.schema.js';
import { createMilestoneSchema, createProjectUpdateSchema } from '../update/update.schema.js';
export const projectRouter = new Hono();
// Projects
projectRouter.get('/', validateQuery(projectQuerySchema), ProjectController.listProjects);
projectRouter.get('/:id', ProjectController.getProjectById);
projectRouter.get('/slug/:slug', ProjectController.getProjectBySlug);
projectRouter.post('/', authMiddleware, requirePermission('PROJECT_CREATE'), validateBody(createProjectSchema), ProjectController.createProject);
projectRouter.put('/:id', authMiddleware, requirePermission('PROJECT_EDIT'), validateBody(updateProjectSchema), ProjectController.updateProject);
projectRouter.patch('/:id/status', authMiddleware, requirePermission('PROJECT_APPROVE'), validateBody(updateProjectStatusSchema), ProjectController.updatePublicationStatus);
projectRouter.delete('/:id', authMiddleware, requirePermission('PROJECT_DELETE'), ProjectController.deleteProject);
// Locations
projectRouter.post('/:projectId/locations', authMiddleware, requirePermission('PROJECT_EDIT'), validateBody(createLocationSchema), LocationController.createLocation);
projectRouter.delete('/:projectId/locations/:locationId', authMiddleware, requirePermission('PROJECT_EDIT'), LocationController.deleteLocation);
// Media
projectRouter.post('/:projectId/media', authMiddleware, requirePermission('MEDIA_UPLOAD'), validateBody(createMediaSchema), MediaController.createMedia);
projectRouter.delete('/:projectId/media/:mediaId', authMiddleware, requirePermission('MEDIA_DELETE'), MediaController.deleteMedia);
// Updates & Milestones
projectRouter.post('/:projectId/updates', authMiddleware, requirePermission('UPDATE_CREATE'), validateBody(createProjectUpdateSchema), UpdateController.createUpdate);
projectRouter.post('/:projectId/milestones', authMiddleware, requirePermission('PROJECT_EDIT'), validateBody(createMilestoneSchema), UpdateController.createMilestone);
// VR Settings & Hotspots
projectRouter.get('/:projectId/vr-settings', VRController.getVRDetails);
projectRouter.put('/:projectId/vr-settings', authMiddleware, requirePermission('PROJECT_EDIT'), VRController.updateVRSettings);
