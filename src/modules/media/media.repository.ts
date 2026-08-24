import { execute, query, queryOne } from '../../db/query.js'
import { NotFoundError } from '../../errors/AppError.js'
import type { CreateMediaDto, UpdateMediaDto } from './media.schema.js'

export interface MediaRow {
  MediaId: number
  ProjectId: number
  MediaType: string
  Title: string | null
  Description: string | null
  MediaUrl: string
  ThumbnailUrl: string | null
  DurationSeconds: number | null
  FileSizeBytes: number | null
  MimeType: string | null
  ApprovalStatus: string
  DisplayOrder: number
  IsFeatured: boolean
  IsPublished: boolean
  UploadedBy: number | null
  ApprovedBy: number | null
  ApprovedAt: string | null
  CreatedAt: string
}

export class MediaRepository {
  public static async findAll(): Promise<(MediaRow & { ProjectName: string; ProjectCode: string })[]> {
    return query<MediaRow & { ProjectName: string; ProjectCode: string }>(`
      SELECT
        pm.*,
        p."ProjectName",
        p."ProjectCode"
      FROM "ProjectMedia" pm
      INNER JOIN "Projects" p ON pm."ProjectId" = p."ProjectId"
      ORDER BY pm."CreatedAt" DESC
    `)
  }

  public static async findByProjectId(projectId: number): Promise<MediaRow[]> {
    return query<MediaRow>(
      `SELECT * FROM "ProjectMedia"
       WHERE "ProjectId" = @projectId
       ORDER BY "DisplayOrder" ASC, "CreatedAt" DESC`,
      [{ name: 'projectId', value: projectId }]
    )
  }

  public static async findById(mediaId: number): Promise<MediaRow | null> {
    return queryOne<MediaRow>('SELECT * FROM "ProjectMedia" WHERE "MediaId" = @mediaId', [
      { name: 'mediaId', value: mediaId },
    ])
  }

  public static async create(dto: CreateMediaDto, userId: number | null): Promise<MediaRow> {
    const res = await execute(
      `INSERT INTO "ProjectMedia" (
        "ProjectId", "MediaType", "Title", "Description", "MediaUrl", "ThumbnailUrl",
        "DurationSeconds", "FileSizeBytes", "MimeType", "ApprovalStatus", "DisplayOrder",
        "IsFeatured", "IsPublished", "UploadedBy"
      )
      VALUES (
        @projectId, @mediaType, @title, @description, @mediaUrl, @thumbnailUrl,
        @durationSeconds, @fileSizeBytes, @mimeType, @approvalStatus, @displayOrder,
        @isFeatured, @isPublished, @uploadedBy
      )
      RETURNING *`,
      [
        { name: 'projectId', value: dto.projectId },
        { name: 'mediaType', value: dto.mediaType },
        { name: 'title', value: dto.title || null },
        { name: 'description', value: dto.description || null },
        { name: 'mediaUrl', value: dto.mediaUrl },
        { name: 'thumbnailUrl', value: dto.thumbnailUrl || null },
        { name: 'durationSeconds', value: dto.durationSeconds || null },
        { name: 'fileSizeBytes', value: dto.fileSizeBytes || null },
        { name: 'mimeType', value: dto.mimeType || null },
        { name: 'approvalStatus', value: dto.approvalStatus },
        { name: 'displayOrder', value: dto.displayOrder },
        { name: 'isFeatured', value: Boolean(dto.isFeatured) },
        { name: 'isPublished', value: Boolean(dto.isPublished) },
        { name: 'uploadedBy', value: userId },
      ]
    )

    return res.recordset?.[0] as MediaRow
  }

  public static async update(mediaId: number, dto: UpdateMediaDto): Promise<MediaRow> {
    const existing = await this.findById(mediaId)
    if (!existing) {
      throw new NotFoundError(`Media item with ID ${mediaId} not found`)
    }

    await execute(
      `UPDATE "ProjectMedia"
       SET "MediaType"       = COALESCE(@mediaType::text, "MediaType"),
           "Title"           = COALESCE(@title::text, "Title"),
           "Description"     = COALESCE(@description::text, "Description"),
           "MediaUrl"        = COALESCE(@mediaUrl::text, "MediaUrl"),
           "ThumbnailUrl"    = COALESCE(@thumbnailUrl::text, "ThumbnailUrl"),
           "DurationSeconds" = COALESCE(@durationSeconds::int, "DurationSeconds"),
           "FileSizeBytes"   = COALESCE(@fileSizeBytes::bigint, "FileSizeBytes"),
           "MimeType"        = COALESCE(@mimeType::text, "MimeType"),
           "ApprovalStatus"  = COALESCE(@approvalStatus::text, "ApprovalStatus"),
           "DisplayOrder"    = COALESCE(@displayOrder::int, "DisplayOrder"),
           "IsFeatured"      = COALESCE(@isFeatured::boolean, "IsFeatured"),
           "IsPublished"     = COALESCE(@isPublished::boolean, "IsPublished")
       WHERE "MediaId" = @mediaId`,
      [
        { name: 'mediaId', value: mediaId },
        { name: 'mediaType', value: dto.mediaType || null },
        { name: 'title', value: dto.title || null },
        { name: 'description', value: dto.description || null },
        { name: 'mediaUrl', value: dto.mediaUrl || null },
        { name: 'thumbnailUrl', value: dto.thumbnailUrl || null },
        { name: 'durationSeconds', value: dto.durationSeconds ?? null },
        { name: 'fileSizeBytes', value: dto.fileSizeBytes ?? null },
        { name: 'mimeType', value: dto.mimeType || null },
        { name: 'approvalStatus', value: dto.approvalStatus || null },
        { name: 'displayOrder', value: dto.displayOrder ?? null },
        { name: 'isFeatured', value: dto.isFeatured ?? null },
        { name: 'isPublished', value: dto.isPublished ?? null },
      ]
    )

    return (await this.findById(mediaId))!
  }

  public static async delete(mediaId: number): Promise<void> {
    const existing = await this.findById(mediaId)
    if (!existing) {
      throw new NotFoundError(`Media item with ID ${mediaId} not found`)
    }
    await execute('DELETE FROM "ProjectMedia" WHERE "MediaId" = @mediaId', [{ name: 'mediaId', value: mediaId }])
  }
}
