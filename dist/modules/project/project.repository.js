import { execute, query, queryOne } from '../../db/query.js';
import { ConflictError, NotFoundError } from '../../errors/AppError.js';
import { AuditRepository } from '../audit/audit.repository.js';
/**
 * Projects carry no location columns of their own — County and the
 * coordinates live in ProjectLocations. Every read joins the primary
 * location so the editor dashboard and the public map can show a place
 * without issuing a follow-up query per row.
 */
const PRIMARY_LOCATION_JOIN = `
  LEFT JOIN LATERAL (
    SELECT pl."LocationName", pl."County", pl."SubCounty", pl."Ward", pl."Latitude", pl."Longitude"
    FROM "ProjectLocations" pl
    WHERE pl."ProjectId" = p."ProjectId"
    ORDER BY pl."IsPrimaryLocation" DESC, pl."LocationId" ASC
    LIMIT 1
  ) loc ON TRUE`;
const PROJECT_SELECT_COLUMNS = `
  p.*,
  loc."LocationName", loc."County", loc."SubCounty", loc."Ward", loc."Latitude", loc."Longitude"`;
export class ProjectRepository {
    static generateSlug(name) {
        return name
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
    static async findAll(queryDto) {
        const params = [];
        const conditions = [];
        if (queryDto.search) {
            conditions.push(`(p."ProjectCode" ILIKE @search OR p."ProjectName" ILIKE @search OR p."ShortDescription" ILIKE @search)`);
            params.push({ name: 'search', value: `%${queryDto.search}%` });
        }
        if (queryDto.projectStatus) {
            conditions.push('p."ProjectStatus" = @projectStatus');
            params.push({ name: 'projectStatus', value: queryDto.projectStatus });
        }
        if (queryDto.publicationStatus) {
            conditions.push('p."PublicationStatus" = @publicationStatus');
            params.push({ name: 'publicationStatus', value: queryDto.publicationStatus });
        }
        if (queryDto.isFeatured !== undefined) {
            conditions.push('p."IsFeatured" = @isFeatured');
            params.push({ name: 'isFeatured', value: queryDto.isFeatured });
        }
        if (queryDto.isPublished !== undefined) {
            conditions.push('p."IsPublished" = @isPublished');
            params.push({ name: 'isPublished', value: queryDto.isPublished });
        }
        if (queryDto.county) {
            conditions.push('EXISTS (SELECT 1 FROM "ProjectLocations" pl WHERE pl."ProjectId" = p."ProjectId" AND pl."County" = @county)');
            params.push({ name: 'county', value: queryDto.county });
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const offset = (queryDto.page - 1) * queryDto.limit;
        const countResult = await queryOne(`SELECT COUNT(*)::int AS total FROM "Projects" p ${whereClause}`, params);
        const totalItems = countResult?.total || 0;
        // page/limit are integers produced by the zod schema, never raw input.
        const sql = `
      SELECT ${PROJECT_SELECT_COLUMNS}
      FROM "Projects" p
      ${PRIMARY_LOCATION_JOIN}
      ${whereClause}
      ORDER BY p."CreatedAt" DESC
      LIMIT ${queryDto.limit} OFFSET ${offset}
    `;
        const items = await query(sql, params);
        return {
            items,
            pagination: {
                page: queryDto.page,
                limit: queryDto.limit,
                totalItems,
                totalPages: Math.ceil(totalItems / queryDto.limit),
            },
        };
    }
    static async findById(id) {
        return queryOne(`SELECT ${PROJECT_SELECT_COLUMNS} FROM "Projects" p ${PRIMARY_LOCATION_JOIN} WHERE p."ProjectId" = @id`, [{ name: 'id', value: id }]);
    }
    static async findBySlug(slug) {
        return queryOne(`SELECT ${PROJECT_SELECT_COLUMNS} FROM "Projects" p ${PRIMARY_LOCATION_JOIN} WHERE p."Slug" = @slug`, [{ name: 'slug', value: slug }]);
    }
    static async findByCode(code) {
        return queryOne('SELECT * FROM "Projects" WHERE "ProjectCode" = @code', [
            { name: 'code', value: code },
        ]);
    }
    static async create(dto, userId) {
        const existingCode = await this.findByCode(dto.projectCode);
        if (existingCode) {
            throw new ConflictError(`Project with code '${dto.projectCode}' already exists`);
        }
        const slug = dto.slug || this.generateSlug(dto.projectName);
        const existingSlug = await this.findBySlug(slug);
        if (existingSlug) {
            throw new ConflictError(`Project with slug '${slug}' already exists`);
        }
        const res = await execute(`INSERT INTO "Projects" (
        "ProjectCode", "ProjectName", "Slug", "ShortDescription", "FullDescription",
        "ProjectStatus", "PublicationStatus", "StartDate", "ExpectedCompletionDate", "CompletionDate",
        "ProjectCost", "CurrencyCode", "LengthKm", "IsFeatured", "IsPublished", "CreatedBy"
      )
      VALUES (
        @projectCode, @projectName, @slug, @shortDescription, @fullDescription,
        @projectStatus, @publicationStatus, @startDate, @expectedCompletionDate, @completionDate,
        @projectCost, @currencyCode, @lengthKm, @isFeatured, @isPublished, @createdBy
      )
      RETURNING *`, [
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
            { name: 'projectCost', value: dto.projectCost ?? null },
            { name: 'currencyCode', value: dto.currencyCode || 'KES' },
            { name: 'lengthKm', value: dto.lengthKm ?? null },
            { name: 'isFeatured', value: Boolean(dto.isFeatured) },
            { name: 'isPublished', value: Boolean(dto.isPublished) },
            { name: 'createdBy', value: userId },
        ]);
        const createdProject = res.recordset?.[0];
        if (dto.categoryIds && dto.categoryIds.length > 0) {
            for (const catId of dto.categoryIds) {
                await execute('INSERT INTO "ProjectCategoryMap" ("ProjectId", "CategoryId") VALUES (@projectId, @categoryId)', [
                    { name: 'projectId', value: createdProject.ProjectId },
                    { name: 'categoryId', value: catId },
                ]);
            }
        }
        await execute('INSERT INTO "VRProjectSettings" ("ProjectId") VALUES (@projectId)', [
            { name: 'projectId', value: createdProject.ProjectId },
        ]);
        if (dto.county || (dto.latitude !== undefined && dto.longitude !== undefined)) {
            await execute(`INSERT INTO "ProjectLocations" (
          "ProjectId", "LocationName", "County", "SubCounty", "Latitude", "Longitude", "IsPrimaryLocation"
        ) VALUES (
          @projectId, @locationName, @county, @subCounty, @lat, @lng, TRUE
        )`, [
                { name: 'projectId', value: createdProject.ProjectId },
                { name: 'locationName', value: dto.projectName },
                { name: 'county', value: dto.county || 'Nairobi' },
                { name: 'subCounty', value: dto.subCounty || '' },
                { name: 'lat', value: dto.latitude ?? -1.286389 },
                { name: 'lng', value: dto.longitude ?? 36.817222 },
            ]);
        }
        await AuditRepository.logWorkflow(createdProject.ProjectId, 'CREATE_PROJECT', null, dto.publicationStatus, 'Project created', userId);
        await AuditRepository.log(userId, 'CREATE', 'Projects', createdProject.ProjectId.toString(), null, createdProject);
        return createdProject;
    }
    static async update(id, dto, userId) {
        const existing = await this.findById(id);
        if (!existing) {
            throw new NotFoundError(`Project with ID ${id} not found`);
        }
        const slug = dto.slug || (dto.projectName ? this.generateSlug(dto.projectName) : existing.Slug);
        // Every parameter is cast explicitly: COALESCE over an untyped NULL
        // placeholder leaves Postgres unable to resolve the argument types.
        await execute(`UPDATE "Projects"
       SET "ProjectName"            = COALESCE(@projectName::text, "ProjectName"),
           "Slug"                   = COALESCE(@slug::text, "Slug"),
           "ShortDescription"       = COALESCE(@shortDescription::text, "ShortDescription"),
           "FullDescription"        = COALESCE(@fullDescription::text, "FullDescription"),
           "ProjectStatus"          = COALESCE(@projectStatus::text, "ProjectStatus"),
           "PublicationStatus"      = COALESCE(@publicationStatus::text, "PublicationStatus"),
           "StartDate"              = COALESCE(@startDate::date, "StartDate"),
           "ExpectedCompletionDate" = COALESCE(@expectedCompletionDate::date, "ExpectedCompletionDate"),
           "CompletionDate"         = COALESCE(@completionDate::date, "CompletionDate"),
           "ProjectCost"            = COALESCE(@projectCost::numeric, "ProjectCost"),
           "CurrencyCode"           = COALESCE(@currencyCode::char(3), "CurrencyCode"),
           "LengthKm"               = COALESCE(@lengthKm::numeric, "LengthKm"),
           "IsFeatured"             = COALESCE(@isFeatured::boolean, "IsFeatured"),
           "IsPublished"            = COALESCE(@isPublished::boolean, "IsPublished"),
           "UpdatedBy"              = @updatedBy
       WHERE "ProjectId" = @id`, [
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
            { name: 'projectCost', value: dto.projectCost ?? null },
            { name: 'currencyCode', value: dto.currencyCode || null },
            { name: 'lengthKm', value: dto.lengthKm ?? null },
            { name: 'isFeatured', value: dto.isFeatured ?? null },
            { name: 'isPublished', value: dto.isPublished ?? null },
            { name: 'updatedBy', value: userId },
        ]);
        if (dto.county !== undefined ||
            dto.subCounty !== undefined ||
            dto.latitude !== undefined ||
            dto.longitude !== undefined) {
            const loc = await queryOne('SELECT "LocationId" FROM "ProjectLocations" WHERE "ProjectId" = @id AND "IsPrimaryLocation" = TRUE', [{ name: 'id', value: id }]);
            if (loc) {
                await execute(`UPDATE "ProjectLocations"
           SET "County"    = COALESCE(@county::text, "County"),
               "SubCounty" = COALESCE(@subCounty::text, "SubCounty"),
               "Latitude"  = COALESCE(@latitude::numeric, "Latitude"),
               "Longitude" = COALESCE(@longitude::numeric, "Longitude")
           WHERE "ProjectId" = @id AND "IsPrimaryLocation" = TRUE`, [
                    { name: 'id', value: id },
                    { name: 'county', value: dto.county ?? null },
                    { name: 'subCounty', value: dto.subCounty ?? null },
                    { name: 'latitude', value: dto.latitude ?? null },
                    { name: 'longitude', value: dto.longitude ?? null },
                ]);
            }
            else if (dto.county || (dto.latitude && dto.longitude)) {
                await execute(`INSERT INTO "ProjectLocations" (
            "ProjectId", "LocationName", "County", "SubCounty", "Latitude", "Longitude", "IsPrimaryLocation"
          )
          VALUES (@id, @name, @county, @subCounty, @latitude, @longitude, TRUE)`, [
                    { name: 'id', value: id },
                    { name: 'name', value: dto.projectName || existing.ProjectName },
                    { name: 'county', value: dto.county || 'Nairobi' },
                    { name: 'subCounty', value: dto.subCounty || '' },
                    { name: 'latitude', value: dto.latitude ?? -1.286389 },
                    { name: 'longitude', value: dto.longitude ?? 36.817222 },
                ]);
            }
        }
        const updatedProject = (await this.findById(id));
        await AuditRepository.log(userId, 'UPDATE', 'Projects', id.toString(), existing, updatedProject);
        return updatedProject;
    }
    static async updatePublicationStatus(id, newStatus, comment, userId) {
        const existing = await this.findById(id);
        if (!existing) {
            throw new NotFoundError(`Project with ID ${id} not found`);
        }
        const isPublished = newStatus === 'Published';
        const publishedAtClause = isPublished
            ? '"PublishedAt" = NOW(), "ApprovedAt" = NOW(), "ApprovedBy" = @userId,'
            : '';
        await execute(`UPDATE "Projects"
       SET "PublicationStatus" = @newStatus,
           "IsPublished" = @isPublished,
           ${publishedAtClause}
           "UpdatedBy" = @userId
       WHERE "ProjectId" = @id`, [
            { name: 'id', value: id },
            { name: 'newStatus', value: newStatus },
            { name: 'isPublished', value: isPublished },
            { name: 'userId', value: userId },
        ]);
        const updated = (await this.findById(id));
        await AuditRepository.logWorkflow(id, 'STATUS_CHANGE', existing.PublicationStatus, newStatus, comment || `Publication status changed to ${newStatus}`, userId);
        await AuditRepository.log(userId, 'STATUS_UPDATE', 'Projects', id.toString(), { publicationStatus: existing.PublicationStatus }, { publicationStatus: newStatus });
        return updated;
    }
    static async delete(id, userId) {
        const existing = await this.findById(id);
        if (!existing) {
            throw new NotFoundError(`Project with ID ${id} not found`);
        }
        await execute('DELETE FROM "Projects" WHERE "ProjectId" = @id', [{ name: 'id', value: id }]);
        await AuditRepository.log(userId, 'DELETE', 'Projects', id.toString(), existing, null);
    }
}
