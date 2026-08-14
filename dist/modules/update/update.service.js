import { UpdateRepository } from './update.repository.js';
export class UpdateService {
    static async getUpdatesByProject(projectId) {
        return UpdateRepository.findUpdatesByProjectId(projectId);
    }
    static async createUpdate(dto, userId) {
        return UpdateRepository.createUpdate(dto, userId);
    }
    static async updateUpdate(updateId, dto) {
        return UpdateRepository.updateUpdate(updateId, dto);
    }
    static async deleteUpdate(updateId) {
        return UpdateRepository.deleteUpdate(updateId);
    }
    static async getMilestonesByProject(projectId) {
        return UpdateRepository.findMilestonesByProjectId(projectId);
    }
    static async createMilestone(dto) {
        return UpdateRepository.createMilestone(dto);
    }
    static async updateMilestone(milestoneId, dto) {
        return UpdateRepository.updateMilestone(milestoneId, dto);
    }
    static async deleteMilestone(milestoneId) {
        return UpdateRepository.deleteMilestone(milestoneId);
    }
}
