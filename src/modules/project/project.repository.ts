import { execute, query, queryOne, type SqlParam } from '../../db/query.js'
import { ConflictError, NotFoundError } from '../../errors/AppError.js'
import type { CreateProjectDto, ProjectQueryDto, UpdateProjectDto } from './project.schema.js'
import { AuditRepository } from '../audit/audit.repository.js'

export interface ProjectRow {
  ProjectId: number
  ProjectCode: string
  ProjectName: string
  Slug: string
  ShortDescription: string | null
  FullDescription: string | null
  ProjectStatus: string
  PublicationStatus: string
  StartDate: string | null
  ExpectedCompletionDate: string | null
  CompletionDate: string | null
  ProjectCost: number | null
  CurrencyCode: string
  LengthKm: number | null
  IsFeatured: boolean
  IsPublished: boolean
  CreatedBy: number | null
  UpdatedBy: number | null
  ApprovedBy: number | null
  ApprovedAt: string | null
  PublishedAt: string | null
  CreatedAt: string
  UpdatedAt: string
}

export class ProjectRepository {
  private static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  public static async findAll(queryDto: ProjectQueryDto) {
    const params: SqlParam[] = []
    const conditions: string[] = []

    if (queryDto.search) {
      conditions.push('(p.ProjectCode LIKE @search OR p.ProjectName LIKE @search OR p.ShortDescription LIKE @search)')
      params.push({ name: 'search', value: `%${queryDto.search}%` })
    }

    if (queryDto.projectStatus) {
      conditions.push('p.ProjectStatus = @projectStatus')
      params.push({ name: 'projectStatus', value: queryDto.projectStatus })
    }

    if (queryDto.publicationStatus) {
      conditions.push('p.PublicationStatus = @publicationStatus')
      params.push({ name: 'publicationStatus', value: queryDto.publicationStatus })
    }

    if (queryDto.isFeatured !== undefined) {
      conditions.push('p.IsFeatured = @isFeatured')
      params.push({ name: 'isFeatured', value: queryDto.isFeatured ? 1 : 0 })
    }

    if (queryDto.isPublished !== undefined) {
      conditions.push('p.IsPublished = @isPublished')
      params.push({ name: 'isPublished', value: queryDto.isPublished ? 1 : 0 })
    }

    if (queryDto.county) {
      conditions.push('EXISTS (SELECT 1 FROM ProjectLocations pl WHERE pl.ProjectId = p.ProjectId AND pl.County = @county)')
      params.push({ name: 'county', value: queryDto.county })
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (queryDto.page - 1) * queryDto.limit

    const countSql = `SELECT COUNT(*) AS total FROM Projects p ${whereClause}`
    const countResult = await queryOne<{ total: number }>(countSql, params)
    const totalItems = countResult?.total || 0

    const sql = `
      SELECT p.*
      FROM Projects p
      ${whereClause}
      ORDER BY p.CreatedAt DESC
      OFFSET ${offset} ROWS FETCH NEXT ${queryDto.limit} ROWS ONLY
    `
    const items = await query<ProjectRow>(sql, params)

    return {
      items,
      pagination: {
        page: queryDto.page,
        limit: queryDto.limit,
        totalItems,
        totalPages: Math.ceil(totalItems / queryDto.limit),
      },
    }
  }

  public static async findById(id: number): Promise<ProjectRow | null> {
    return queryOne<ProjectRow>('SELECT * FROM Projects WHERE ProjectId = @id', [{ name: 'id', value: id }])
  }

  public static async findBySlug(slug: string): Promise<ProjectRow | null> {
    return queryOne<ProjectRow>('SELECT * FROM Projects WHERE Slug = @slug', [{ name: 'slug', value: slug }])
  }

  public static async findByCode(code: string): Promise<ProjectRow | null> {
    return queryOne<ProjectRow>('SELECT * FROM Projects WHERE ProjectCode = @code', [{ name: 'code', value: code }])
  }

  public static async create(dto: CreateProjectDto, userId: number | null): Promise<ProjectRow> {
    const existingCode = await this.findByCode(dto.projectCode)
    if (existingCode) {
      throw new ConflictError(`Project with code '${dto.projectCode}' already exists`)
    }

    const slug = dto.slug || this.generateSlug(dto.projectName)
    const existingSlug = await this.findBySlug(slug)
    if (existingSlug) {
      throw new ConflictError(`Project with slug '${slug}' already exists`)
    }

    const res = await execute(
      `INSERT INTO Projects (
        ProjectCode, ProjectName, Slug, ShortDescription, FullDescription,
        ProjectStatus, PublicationStatus, StartDate, ExpectedCompletionDate, CompletionDate,
        ProjectCost, CurrencyCode, LengthKm, IsFeatured, IsPublished, CreatedBy
      )
      OUTPUT INSERTED.*
      VALUES (
        @projectCode, @projectName, @slug, @shortDescription, @fullDescription,
        @projectStatus, @publicationStatus, @startDate, @expectedCompletionDate, @completionDate,
        @projectCost, @currencyCode, @lengthKm, @isFeatured, @isPublished, @createdBy
      )`,
      [
        { name: 'projectCode', value: dto.projectCode },
        { name: 'projectName', value: dto.projectName },
        { name: 'slug', value: slug },
        { name: 'shortDescription', value: dto.shortDescription || null },
        { name: 'fullDescription', value: dto.fullDescription || null },
        { name: 'projectStatus', value: dto.projectStatus },
        { name: 'publicationStatus', value: dto.publicationStatus },
        { name: 'startDate', value: dto.startDate || null },
        { name: 'expectedCompletionDate', value: dto.expectedCompletionDate || null },
        { name: 'completionDate', value: dto.completionDate || null },
        { name: 'projectCost', value: dto.projectCost || null },
        { name: 'currencyCode', value: dto.currencyCode || 'KES' },
        { name: 'lengthKm', value: dto.lengthKm || null },
        { name: 'isFeatured', value: dto.isFeatured ? 1 : 0 },
        { name: 'isPublished', value: dto.isPublished ? 1 : 0 },
        { name: 'createdBy', value: userId },
      ]
    )

    const createdProject = res.recordset?.[0] as ProjectRow

    if (dto.categoryIds && dto.categoryIds.length > 0) {
      for (const catId of dto.categoryIds) {
        await execute('INSERT INTO ProjectCategoryMap (ProjectId, CategoryId) VALUES (@projectId, @categoryId)', [
          { name: 'projectId', value: createdProject.ProjectId },
          { name: 'categoryId', value: catId },
        ])
      }
    }

    await execute('INSERT INTO VRProjectSettings (ProjectId) VALUES (@projectId)', [
      { name: 'projectId', value: createdProject.ProjectId },
    ])

    await AuditRepository.logWorkflow(createdProject.ProjectId, 'CREATE_PROJECT', null, dto.publicationStatus, 'Project created', userId)
    await AuditRepository.log(userId, 'CREATE', 'Projects', createdProject.ProjectId.toString(), null, createdProject)

    return createdProject
  }

  public static async update(id: number, dto: UpdateProjectDto, userId: number | null): Promise<ProjectRow> {
    const existing = await this.findById(id)
    if (!existing) {
      throw new NotFoundError(`Project with ID ${id} not found`)
    }

    const slug = dto.slug || (dto.projectName ? this.generateSlug(dto.projectName) : existing.Slug)

    await execute(
      `UPDATE Projects
       SET ProjectName = ISNULL(@projectName, ProjectName),
           Slug = ISNULL(@slug, Slug),
           ShortDescription = ISNULL(@shortDescription, ShortDescription),
           FullDescription = ISNULL(@fullDescription, FullDescription),
           ProjectStatus = ISNULL(@projectStatus, ProjectStatus),
           PublicationStatus = ISNULL(@publicationStatus, PublicationStatus),
           StartDate = ISNULL(@startDate, StartDate),
           ExpectedCompletionDate = ISNULL(@expectedCompletionDate, ExpectedCompletionDate),
           CompletionDate = ISNULL(@completionDate, CompletionDate),
           ProjectCost = ISNULL(@projectCost, ProjectCost),
           CurrencyCode = ISNULL(@currencyCode, CurrencyCode),
           LengthKm = ISNULL(@lengthKm, LengthKm),
           IsFeatured = ISNULL(@isFeatured, IsFeatured),
           IsPublished = ISNULL(@isPublished, IsPublished),
           UpdatedBy = @updatedBy,
           UpdatedAt = SYSUTCDATETIME()
       WHERE ProjectId = @id`,
      [
        { name: 'id', value: id },
        { name: 'projectName', value: dto.projectName || null },
        { name: 'slug', value: slug },
        { name: 'shortDescription', value: dto.shortDescription || null },
        { name: 'fullDescription', value: dto.fullDescription || null },
        { name: 'projectStatus', value: dto.projectStatus || null },
        { name: 'publicationStatus', value: dto.publicationStatus || null },
        { name: 'startDate', value: dto.startDate || null },
        { name: 'expectedCompletionDate', value: dto.expectedCompletionDate || null },
        { name: 'completionDate', value: dto.completionDate || null },
        { name: 'projectCost', value: dto.projectCost || null },
        { name: 'currencyCode', value: dto.currencyCode || null },
        { name: 'lengthKm', value: dto.lengthKm || null },
        { name: 'isFeatured', value: dto.isFeatured !== undefined ? (dto.isFeatured ? 1 : 0) : null },
        { name: 'isPublished', value: dto.isPublished !== undefined ? (dto.isPublished ? 1 : 0) : null },
        { name: 'updatedBy', value: userId },
      ]
    )

    const updatedProject = (await this.findById(id))!
    await AuditRepository.log(userId, 'UPDATE', 'Projects', id.toString(), existing, updatedProject)
    return updatedProject
  }

  public static async updatePublicationStatus(
    id: number,
    newStatus: string,
    comment: string | null,
    userId: number | null
  ): Promise<ProjectRow> {
    const existing = await this.findById(id)
    if (!existing) {
      throw new NotFoundError(`Project with ID ${id} not found`)
    }

    const isPublished = newStatus === 'Published'
    const publishedAtClause = isPublished ? 'PublishedAt = SYSUTCDATETIME(), ApprovedAt = SYSUTCDATETIME(), ApprovedBy = @userId,' : ''

    await execute(
      `UPDATE Projects
       SET PublicationStatus = @newStatus,
           IsPublished = @isPublished,
           ${publishedAtClause}
           UpdatedBy = @userId,
           UpdatedAt = SYSUTCDATETIME()
       WHERE ProjectId = @id`,
      [
        { name: 'id', value: id },
        { name: 'newStatus', value: newStatus },
        { name: 'isPublished', value: isPublished ? 1 : 0 },
        { name: 'userId', value: userId },
      ]
    )

    const updated = (await this.findById(id))!

    await AuditRepository.logWorkflow(
      id,
      'STATUS_CHANGE',
      existing.PublicationStatus,
      newStatus,
      comment || `Publication status changed to ${newStatus}`,
      userId
    )
    await AuditRepository.log(userId, 'STATUS_UPDATE', 'Projects', id.toString(), { publicationStatus: existing.PublicationStatus }, { publicationStatus: newStatus })

    return updated
  }

  public static async delete(id: number, userId: number | null): Promise<void> {
    const existing = await this.findById(id)
    if (!existing) {
      throw new NotFoundError(`Project with ID ${id} not found`)
    }

    await execute('DELETE FROM Projects WHERE ProjectId = @id', [{ name: 'id', value: id }])
    await AuditRepository.log(userId, 'DELETE', 'Projects', id.toString(), existing, null)
  }
}
