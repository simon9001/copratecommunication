import { execute, query, queryOne } from '../../db/query.js';
import { NotFoundError } from '../../errors/AppError.js';
export class UpdateRepository {
    static async findUpdatesByProjectId(projectId) {
        return query('SELECT * FROM ProjectUpdates WHERE ProjectId = @projectId ORDER BY UpdateDate DESC', [
            { name: 'projectId', value: projectId },
        ]);
    }
    static async findUpdateById(updateId) {
        return queryOne('SELECT * FROM ProjectUpdates WHERE UpdateId = @updateId', [{ name: 'updateId', value: updateId }]);
    }
    static async createUpdate(dto, userId) {
        const res = await execute(`INSERT INTO ProjectUpdates (
        ProjectId, Title, Content, ProgressPercentage, UpdateDate, PublicationStatus, CreatedBy
      )
      OUTPUT INSERTED.*
      VALUES (
        @projectId, @title, @content, @progressPercentage, @updateDate, @publicationStatus, @createdBy
      )`, [
            { name: 'projectId', value: dto.projectId },
            { name: 'title', value: dto.title },
            { name: 'content', value: dto.content },
            { name: 'progressPercentage', value: dto.progressPercentage || null },
            { name: 'updateDate', value: dto.updateDate },
            { name: 'publicationStatus', value: dto.publicationStatus },
            { name: 'createdBy', value: userId },
        ]);
        return res.recordset?.[0];
    }
    static async updateUpdate(updateId, dto) {
        const existing = await this.findUpdateById(updateId);
        if (!existing)
            throw new NotFoundError(`Project Update with ID ${updateId} not found`);
        await execute(`UPDATE ProjectUpdates
       SET Title = ISNULL(@title, Title),
           Content = ISNULL(@content, Content),
           ProgressPercentage = ISNULL(@progressPercentage, ProgressPercentage),
           UpdateDate = ISNULL(@updateDate, UpdateDate),
           PublicationStatus = ISNULL(@publicationStatus, PublicationStatus),
           UpdatedAt = SYSUTCDATETIME()
       WHERE UpdateId = @updateId`, [
            { name: 'updateId', value: updateId },
            { name: 'title', value: dto.title || null },
            { name: 'content', value: dto.content || null },
            { name: 'progressPercentage', value: dto.progressPercentage ?? null },
            { name: 'updateDate', value: dto.updateDate || null },
            { name: 'publicationStatus', value: dto.publicationStatus || null },
        ]);
        return (await this.findUpdateById(updateId));
    }
    static async deleteUpdate(updateId) {
        const existing = await this.findUpdateById(updateId);
        if (!existing)
            throw new NotFoundError(`Project Update with ID ${updateId} not found`);
        await execute('DELETE FROM ProjectUpdates WHERE UpdateId = @updateId', [{ name: 'updateId', value: updateId }]);
    }
    static async findMilestonesByProjectId(projectId) {
        return query('SELECT * FROM ProjectMilestones WHERE ProjectId = @projectId ORDER BY MilestoneDate ASC', [
            { name: 'projectId', value: projectId },
        ]);
    }
    static async findMilestoneById(milestoneId) {
        return queryOne('SELECT * FROM ProjectMilestones WHERE MilestoneId = @milestoneId', [
            { name: 'milestoneId', value: milestoneId },
        ]);
    }
    static async createMilestone(dto) {
        const res = await execute(`INSERT INTO ProjectMilestones (
        ProjectId, Title, Description, MilestoneDate, CompletionPercentage, Status
      )
      OUTPUT INSERTED.*
      VALUES (
        @projectId, @title, @description, @milestoneDate, @completionPercentage, @status
      )`, [
            { name: 'projectId', value: dto.projectId },
            { name: 'title', value: dto.title },
            { name: 'description', value: dto.description || null },
            { name: 'milestoneDate', value: dto.milestoneDate || null },
            { name: 'completionPercentage', value: dto.completionPercentage || null },
            { name: 'status', value: dto.status },
        ]);
        return res.recordset?.[0];
    }
    static async updateMilestone(milestoneId, dto) {
        const existing = await this.findMilestoneById(milestoneId);
        if (!existing)
            throw new NotFoundError(`Project Milestone with ID ${milestoneId} not found`);
        await execute(`UPDATE ProjectMilestones
       SET Title = ISNULL(@title, Title),
           Description = ISNULL(@description, Description),
           MilestoneDate = ISNULL(@milestoneDate, MilestoneDate),
           CompletionPercentage = ISNULL(@completionPercentage, CompletionPercentage),
           Status = ISNULL(@status, Status)
       WHERE MilestoneId = @milestoneId`, [
            { name: 'milestoneId', value: milestoneId },
            { name: 'title', value: dto.title || null },
            { name: 'description', value: dto.description || null },
            { name: 'milestoneDate', value: dto.milestoneDate || null },
            { name: 'completionPercentage', value: dto.completionPercentage ?? null },
            { name: 'status', value: dto.status || null },
        ]);
        return (await this.findMilestoneById(milestoneId));
    }
    static async deleteMilestone(milestoneId) {
        const existing = await this.findMilestoneById(milestoneId);
        if (!existing)
            throw new NotFoundError(`Project Milestone with ID ${milestoneId} not found`);
        await execute('DELETE FROM ProjectMilestones WHERE MilestoneId = @milestoneId', [{ name: 'milestoneId', value: milestoneId }]);
    }
}
