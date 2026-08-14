import { ProjectRepository } from './project.repository.js';
import { LocationRepository } from '../location/location.repository.js';
import { MediaRepository } from '../media/media.repository.js';
import { UpdateRepository } from '../update/update.repository.js';
import { VRRepository } from '../vr/vr.repository.js';
import { NotFoundError } from '../../errors/AppError.js';
export class ProjectService {
    static async listProjects(queryDto) {
        return ProjectRepository.findAll(queryDto);
    }
    static async getProjectById(id) {
        const project = await ProjectRepository.findById(id);
        if (!project) {
            throw new NotFoundError(`Project with ID ${id} not found`);
        }
        const locations = await LocationRepository.findByProjectId(id);
        const media = await MediaRepository.findByProjectId(id);
        const updates = await UpdateRepository.findUpdatesByProjectId(id);
        const milestones = await UpdateRepository.findMilestonesByProjectId(id);
        const vrSettings = await VRRepository.getSettings(id);
        return {
            ...project,
            locations,
            media,
            updates,
            milestones,
            vrSettings,
        };
    }
    static async getProjectBySlug(slug) {
        const project = await ProjectRepository.findBySlug(slug);
        if (!project) {
            throw new NotFoundError(`Project with slug '${slug}' not found`);
        }
        const locations = await LocationRepository.findByProjectId(project.ProjectId);
        const media = await MediaRepository.findByProjectId(project.ProjectId);
        return {
            ...project,
            locations,
            media,
        };
    }
    static async createProject(dto, userId) {
        return ProjectRepository.create(dto, userId);
    }
    static async updateProject(id, dto, userId) {
        return ProjectRepository.update(id, dto, userId);
    }
    static async updatePublicationStatus(id, dto, userId) {
        return ProjectRepository.updatePublicationStatus(id, dto.publicationStatus, dto.comment || null, userId);
    }
    static async deleteProject(id, userId) {
        return ProjectRepository.delete(id, userId);
    }
}
