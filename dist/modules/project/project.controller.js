import { ProjectService } from './project.service.js';
import { createSuccessResponse } from '../../errors/errorResponse.js';
export class ProjectController {
    static async listProjects(c) {
        const queryDto = c.get('validatedQuery');
        const result = await ProjectService.listProjects(queryDto);
        return c.json(createSuccessResponse(result.items, 'Projects list retrieved', result.pagination, c.get('requestId')));
    }
    static async getProjectById(c) {
        const paramId = c.req.param('id') || '';
        const id = parseInt(paramId, 10);
        const project = await ProjectService.getProjectById(id);
        return c.json(createSuccessResponse(project, 'Project details retrieved', undefined, c.get('requestId')));
    }
    static async getProjectBySlug(c) {
        const slug = c.req.param('slug') || '';
        const project = await ProjectService.getProjectBySlug(slug);
        return c.json(createSuccessResponse(project, 'Project details retrieved', undefined, c.get('requestId')));
    }
    static async createProject(c) {
        const user = c.get('user');
        const body = c.get('validatedBody');
        const created = await ProjectService.createProject(body, user.userId);
        return c.json(createSuccessResponse(created, 'Project created successfully', undefined, c.get('requestId')), 201);
    }
    static async updateProject(c) {
        const paramId = c.req.param('id') || '';
        const id = parseInt(paramId, 10);
        const user = c.get('user');
        const body = c.get('validatedBody');
        const updated = await ProjectService.updateProject(id, body, user.userId);
        return c.json(createSuccessResponse(updated, 'Project updated successfully', undefined, c.get('requestId')));
    }
    static async updatePublicationStatus(c) {
        const paramId = c.req.param('id') || '';
        const id = parseInt(paramId, 10);
        const user = c.get('user');
        const body = c.get('validatedBody');
        const updated = await ProjectService.updatePublicationStatus(id, body, user.userId);
        return c.json(createSuccessResponse(updated, `Project publication status updated to '${body.publicationStatus}'`, undefined, c.get('requestId')));
    }
    static async deleteProject(c) {
        const paramId = c.req.param('id') || '';
        const id = parseInt(paramId, 10);
        const user = c.get('user');
        await ProjectService.deleteProject(id, user.userId);
        return c.json(createSuccessResponse(null, `Project ${id} deleted successfully`, undefined, c.get('requestId')));
    }
}
