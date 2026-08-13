import { ProjectRepository } from './project.repository.js'
import { LocationRepository } from '../location/location.repository.js'
import { MediaRepository } from '../media/media.repository.js'
import { UpdateRepository } from '../update/update.repository.js'
import { VRRepository } from '../vr/vr.repository.js'
import { NotFoundError } from '../../errors/AppError.js'
import type {
  CreateProjectDto,
  ProjectQueryDto,
  UpdateProjectDto,
  UpdateProjectStatusDto,
} from './project.schema.js'

export class ProjectService {
  public static async listProjects(queryDto: ProjectQueryDto) {
    return ProjectRepository.findAll(queryDto)
  }

  public static async getProjectById(id: number) {
    const project = await ProjectRepository.findById(id)
    if (!project) {
      throw new NotFoundError(`Project with ID ${id} not found`)
    }

    const locations = await LocationRepository.findByProjectId(id)
    const media = await MediaRepository.findByProjectId(id)
    const updates = await UpdateRepository.findUpdatesByProjectId(id)
    const milestones = await UpdateRepository.findMilestonesByProjectId(id)
    const vrSettings = await VRRepository.getSettings(id)

    return {
      ...project,
      locations,
      media,
      updates,
      milestones,
      vrSettings,
    }
  }

  public static async getProjectBySlug(slug: string) {
    const project = await ProjectRepository.findBySlug(slug)
    if (!project) {
      throw new NotFoundError(`Project with slug '${slug}' not found`)
    }

    const locations = await LocationRepository.findByProjectId(project.ProjectId)
    const media = await MediaRepository.findByProjectId(project.ProjectId)

    return {
      ...project,
      locations,
      media,
    }
  }

  public static async createProject(dto: CreateProjectDto, userId: number | null) {
    return ProjectRepository.create(dto, userId)
  }

  public static async updateProject(id: number, dto: UpdateProjectDto, userId: number | null) {
    return ProjectRepository.update(id, dto, userId)
  }

  public static async updatePublicationStatus(id: number, dto: UpdateProjectStatusDto, userId: number | null) {
    return ProjectRepository.updatePublicationStatus(id, dto.publicationStatus, dto.comment || null, userId)
  }

  public static async deleteProject(id: number, userId: number | null) {
    return ProjectRepository.delete(id, userId)
  }
}
