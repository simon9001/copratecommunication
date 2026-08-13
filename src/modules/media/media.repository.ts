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
  public static async findByProjectId(projectId: number): Promise<MediaRow[]> {
    return query<MediaRow>('SELECT * FROM ProjectMedia WHERE ProjectId = @projectId ORDER BY DisplayOrder ASC, CreatedAt DESC', [
      { name: 'projectId', value: projectId },
    ])
  }

  public static async findById(mediaId: number): Promise<MediaRow | null> {
    return queryOne<MediaRow>('SELECT * FROM ProjectMedia WHERE MediaId = @mediaId', [{ name: 'mediaId', value: mediaId }])
  }

  public static async create(dto: CreateMediaDto, userId: number | null): Promise<MediaRow> {
    const res = await execute(
      `INSERT INTO ProjectMedia (
        ProjectId, MediaType, Title, Description, MediaUrl, ThumbnailUrl,
        DurationSeconds, FileSizeBytes, MimeType, ApprovalStatus, DisplayOrder,
        IsFeatured, IsPublished, UploadedBy
      )
      OUTPUT INSERTED.*
      VALUES (
        @projectId, @mediaType, @title, @description, @mediaUrl, @thumbnailUrl,
        @durationSeconds, @fileSizeBytes, @mimeType, @approvalStatus, @displayOrder,
        @isFeatured, @isPublished, @uploadedBy
      )`,
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
        { name: 'isFeatured', value: dto.isFeatured ? 1 : 0 },
        { name: 'isPublished', value: dto.isPublished ? 1 : 0 },
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
      `UPDATE ProjectMedia
       SET MediaType = ISNULL(@mediaType, MediaType),
           Title = ISNULL(@title, Title),
           Description = ISNULL(@description, Description),
           MediaUrl = ISNULL(@mediaUrl, MediaUrl),
           ThumbnailUrl = ISNULL(@thumbnailUrl, ThumbnailUrl),
           DurationSeconds = ISNULL(@durationSeconds, DurationSeconds),
           FileSizeBytes = ISNULL(@fileSizeBytes, FileSizeBytes),
           MimeType = ISNULL(@mimeType, MimeType),
           ApprovalStatus = ISNULL(@approvalStatus, ApprovalStatus),
           DisplayOrder = ISNULL(@displayOrder, DisplayOrder),
           IsFeatured = ISNULL(@isFeatured, IsFeatured),
           IsPublished = ISNULL(@isPublished, IsPublished)
       WHERE MediaId = @mediaId`,
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
        { name: 'isFeatured', value: dto.isFeatured !== undefined ? (dto.isFeatured ? 1 : 0) : null },
        { name: 'isPublished', value: dto.isPublished !== undefined ? (dto.isPublished ? 1 : 0) : null },
      ]
    )

    return (await this.findById(mediaId))!
  }

  public static async delete(mediaId: number): Promise<void> {
    const existing = await this.findById(mediaId)
    if (!existing) {
      throw new NotFoundError(`Media item with ID ${mediaId} not found`)
    }
    await execute('DELETE FROM ProjectMedia WHERE MediaId = @mediaId', [{ name: 'mediaId', value: mediaId }])
  }
}
