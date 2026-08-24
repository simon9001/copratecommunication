import { execute, query, queryOne } from '../../db/query.js'
import { NotFoundError } from '../../errors/AppError.js'
import type {
  CreateMilestoneDto,
  CreateProjectUpdateDto,
  UpdateMilestoneDto,
  UpdateProjectUpdateDto,
} from './update.schema.js'

export interface ProjectUpdateRow {
  UpdateId: number
  ProjectId: number
  Title: string
  Content: string
  ProgressPercentage: number | null
  UpdateDate: string
  PublicationStatus: string
  CreatedBy: number | null
  ApprovedBy: number | null
  ApprovedAt: string | null
  PublishedAt: string | null
  CreatedAt: string
  UpdatedAt: string
}

export interface ProjectMilestoneRow {
  MilestoneId: number
  ProjectId: number
  Title: string
  Description: string | null
  MilestoneDate: string | null
  CompletionPercentage: number | null
  Status: string
  CreatedAt: string
}

export class UpdateRepository {
  public static async findUpdatesByProjectId(projectId: number): Promise<ProjectUpdateRow[]> {
    return query<ProjectUpdateRow>(
      'SELECT * FROM "ProjectUpdates" WHERE "ProjectId" = @projectId ORDER BY "UpdateDate" DESC',
      [{ name: 'projectId', value: projectId }]
    )
  }

  public static async findUpdateById(updateId: number): Promise<ProjectUpdateRow | null> {
    return queryOne<ProjectUpdateRow>('SELECT * FROM "ProjectUpdates" WHERE "UpdateId" = @updateId', [
      { name: 'updateId', value: updateId },
    ])
  }

  public static async createUpdate(dto: CreateProjectUpdateDto, userId: number | null): Promise<ProjectUpdateRow> {
    const res = await execute(
      `INSERT INTO "ProjectUpdates" (
        "ProjectId", "Title", "Content", "ProgressPercentage", "UpdateDate", "PublicationStatus", "CreatedBy"
      )
      VALUES (
        @projectId, @title, @content, @progressPercentage, @updateDate, @publicationStatus, @createdBy
      )
      RETURNING *`,
      [
        { name: 'projectId', value: dto.projectId },
        { name: 'title', value: dto.title },
        { name: 'content', value: dto.content },
        { name: 'progressPercentage', value: dto.progressPercentage ?? null },
        { name: 'updateDate', value: dto.updateDate },
        { name: 'publicationStatus', value: dto.publicationStatus },
        { name: 'createdBy', value: userId },
      ]
    )
    return res.recordset?.[0] as ProjectUpdateRow
  }

  public static async updateUpdate(updateId: number, dto: UpdateProjectUpdateDto): Promise<ProjectUpdateRow> {
    const existing = await this.findUpdateById(updateId)
    if (!existing) throw new NotFoundError(`Project Update with ID ${updateId} not found`)

    await execute(
      `UPDATE "ProjectUpdates"
       SET "Title"              = COALESCE(@title::text, "Title"),
           "Content"            = COALESCE(@content::text, "Content"),
           "ProgressPercentage" = COALESCE(@progressPercentage::numeric, "ProgressPercentage"),
           "UpdateDate"         = COALESCE(@updateDate::date, "UpdateDate"),
           "PublicationStatus"  = COALESCE(@publicationStatus::text, "PublicationStatus")
       WHERE "UpdateId" = @updateId`,
      [
        { name: 'updateId', value: updateId },
        { name: 'title', value: dto.title || null },
        { name: 'content', value: dto.content || null },
        { name: 'progressPercentage', value: dto.progressPercentage ?? null },
        { name: 'updateDate', value: dto.updateDate || null },
        { name: 'publicationStatus', value: dto.publicationStatus || null },
      ]
    )
    return (await this.findUpdateById(updateId))!
  }

  public static async deleteUpdate(updateId: number): Promise<void> {
    const existing = await this.findUpdateById(updateId)
    if (!existing) throw new NotFoundError(`Project Update with ID ${updateId} not found`)
    await execute('DELETE FROM "ProjectUpdates" WHERE "UpdateId" = @updateId', [{ name: 'updateId', value: updateId }])
  }

  public static async findMilestonesByProjectId(projectId: number): Promise<ProjectMilestoneRow[]> {
    return query<ProjectMilestoneRow>(
      'SELECT * FROM "ProjectMilestones" WHERE "ProjectId" = @projectId ORDER BY "MilestoneDate" ASC',
      [{ name: 'projectId', value: projectId }]
    )
  }

  public static async findMilestoneById(milestoneId: number): Promise<ProjectMilestoneRow | null> {
    return queryOne<ProjectMilestoneRow>('SELECT * FROM "ProjectMilestones" WHERE "MilestoneId" = @milestoneId', [
      { name: 'milestoneId', value: milestoneId },
    ])
  }

  public static async createMilestone(dto: CreateMilestoneDto): Promise<ProjectMilestoneRow> {
    const res = await execute(
      `INSERT INTO "ProjectMilestones" (
        "ProjectId", "Title", "Description", "MilestoneDate", "CompletionPercentage", "Status"
      )
      VALUES (
        @projectId, @title, @description, @milestoneDate, @completionPercentage, @status
      )
      RETURNING *`,
      [
        { name: 'projectId', value: dto.projectId },
        { name: 'title', value: dto.title },
        { name: 'description', value: dto.description || null },
        { name: 'milestoneDate', value: dto.milestoneDate || null },
        { name: 'completionPercentage', value: dto.completionPercentage ?? null },
        { name: 'status', value: dto.status },
      ]
    )
    return res.recordset?.[0] as ProjectMilestoneRow
  }

  public static async updateMilestone(milestoneId: number, dto: UpdateMilestoneDto): Promise<ProjectMilestoneRow> {
    const existing = await this.findMilestoneById(milestoneId)
    if (!existing) throw new NotFoundError(`Project Milestone with ID ${milestoneId} not found`)

    await execute(
      `UPDATE "ProjectMilestones"
       SET "Title"                = COALESCE(@title::text, "Title"),
           "Description"          = COALESCE(@description::text, "Description"),
           "MilestoneDate"        = COALESCE(@milestoneDate::date, "MilestoneDate"),
           "CompletionPercentage" = COALESCE(@completionPercentage::numeric, "CompletionPercentage"),
           "Status"               = COALESCE(@status::text, "Status")
       WHERE "MilestoneId" = @milestoneId`,
      [
        { name: 'milestoneId', value: milestoneId },
        { name: 'title', value: dto.title || null },
        { name: 'description', value: dto.description || null },
        { name: 'milestoneDate', value: dto.milestoneDate || null },
        { name: 'completionPercentage', value: dto.completionPercentage ?? null },
        { name: 'status', value: dto.status || null },
      ]
    )
    return (await this.findMilestoneById(milestoneId))!
  }

  public static async deleteMilestone(milestoneId: number): Promise<void> {
    const existing = await this.findMilestoneById(milestoneId)
    if (!existing) throw new NotFoundError(`Project Milestone with ID ${milestoneId} not found`)
    await execute('DELETE FROM "ProjectMilestones" WHERE "MilestoneId" = @milestoneId', [
      { name: 'milestoneId', value: milestoneId },
    ])
  }
}
