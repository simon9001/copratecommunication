import { UpdateRepository } from './update.repository.js'
import type {
  CreateMilestoneDto,
  CreateProjectUpdateDto,
  UpdateMilestoneDto,
  UpdateProjectUpdateDto,
} from './update.schema.js'

export class UpdateService {
  public static async getUpdatesByProject(projectId: number) {
    return UpdateRepository.findUpdatesByProjectId(projectId)
  }

  public static async createUpdate(dto: CreateProjectUpdateDto, userId: number | null) {
    return UpdateRepository.createUpdate(dto, userId)
  }

  public static async updateUpdate(updateId: number, dto: UpdateProjectUpdateDto) {
    return UpdateRepository.updateUpdate(updateId, dto)
  }

  public static async deleteUpdate(updateId: number) {
    return UpdateRepository.deleteUpdate(updateId)
  }

  public static async getMilestonesByProject(projectId: number) {
    return UpdateRepository.findMilestonesByProjectId(projectId)
  }

  public static async createMilestone(dto: CreateMilestoneDto) {
    return UpdateRepository.createMilestone(dto)
  }

  public static async updateMilestone(milestoneId: number, dto: UpdateMilestoneDto) {
    return UpdateRepository.updateMilestone(milestoneId, dto)
  }

  public static async deleteMilestone(milestoneId: number) {
    return UpdateRepository.deleteMilestone(milestoneId)
  }
}
