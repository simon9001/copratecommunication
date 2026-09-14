import type { SqlParam } from '../../db/query.js'

export interface MapProjectFilters {
  county?: string
  status?: string
  highlights?: boolean
}

/**
 * The visitor map feed. Kept as a pure builder so the filter and ordering
 * rules can be tested without a database.
 */
export function buildMapProjectsQuery(filters: MapProjectFilters = {}): { sql: string; params: SqlParam[] } {
  const conditions: string[] = [`(p."PublicationStatus" = 'Published' OR p."IsPublished" = TRUE)`]
  const params: SqlParam[] = []

  if (filters.county && filters.county !== 'All') {
    conditions.push('LOWER(pl."County") = LOWER(@county)')
    params.push({ name: 'county', value: filters.county })
  }

  if (filters.status && filters.status !== 'All') {
    conditions.push('p."ProjectStatus" = @status')
    params.push({ name: 'status', value: filters.status })
  }

  if (filters.highlights) {
    conditions.push('p."IsShowHighlight" = TRUE')
  }

  const orderBy = filters.highlights
    ? 'ORDER BY p."ShowOrder" ASC NULLS LAST, p."ProjectName" ASC'
    : 'ORDER BY p."IsFeatured" DESC, p."CreatedAt" DESC'

  const sql = `SELECT
      p."ProjectId", p."ProjectCode", p."ProjectName", p."Slug",
      p."ShortDescription", p."ProjectStatus",
      p."IsFeatured", p."PublicationStatus", p."IsPublished",
      p."IsShowHighlight", p."ShowOrder",
      p."StartDate", p."ExpectedCompletionDate", p."CompletionDate",
      p."ProjectCost", p."CurrencyCode", p."LengthKm",
      COALESCE(pl."LocationId", 1)                 AS "LocationId",
      COALESCE(pl."LocationName", p."ProjectName") AS "LocationName",
      COALESCE(pl."County", 'Nairobi')             AS "County",
      COALESCE(pl."SubCounty", '')                 AS "SubCounty",
      pl."Ward",
      COALESCE(pl."Latitude", -1.286389)           AS "Latitude",
      COALESCE(pl."Longitude", 36.817222)          AS "Longitude",
      (
        SELECT pu."ProgressPercentage"
        FROM "ProjectUpdates" pu
        WHERE pu."ProjectId" = p."ProjectId"
          AND pu."PublicationStatus" = 'Published'
        ORDER BY pu."UpdateDate" DESC
        LIMIT 1
      ) AS "ProgressPercentage",
      EXISTS (
        SELECT 1 FROM "ProjectRoutes" pr WHERE pr."ProjectId" = p."ProjectId"
      ) AS "HasRoute",
      fm."MediaUrl"     AS "FeaturedMediaUrl",
      fm."MediaType"    AS "FeaturedMediaType",
      fm."ThumbnailUrl" AS "FeaturedThumbnailUrl",
      EXISTS (
        SELECT 1 FROM "ProjectMedia" m360
        WHERE m360."ProjectId" = p."ProjectId"
          AND m360."MediaType" IN ('360_VIDEO', '360_IMAGE')
      ) AS "Has360"
    FROM "Projects" p
    LEFT JOIN LATERAL (
      SELECT l."LocationId", l."LocationName", l."County", l."SubCounty",
             l."Ward", l."Latitude", l."Longitude"
      FROM "ProjectLocations" l
      WHERE l."ProjectId" = p."ProjectId"
      ORDER BY l."IsPrimaryLocation" DESC, l."LocationId" ASC
      LIMIT 1
    ) pl ON TRUE
    LEFT JOIN LATERAL (
      SELECT m."MediaUrl", m."MediaType", m."ThumbnailUrl"
      FROM "ProjectMedia" m
      WHERE m."ProjectId" = p."ProjectId"
      ORDER BY m."IsFeatured" DESC, m."DisplayOrder" ASC, m."CreatedAt" DESC
      LIMIT 1
    ) fm ON TRUE
    WHERE ${conditions.join(' AND ')}
    ${orderBy}`

  return { sql, params }
}
