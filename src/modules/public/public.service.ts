import { query, queryOne, type SqlParam } from '../../db/query.js'

export class PublicService {
  /**
   * All published map projects, with optional county and status filters.
   * This is the visitor-facing feed that drives the 3D globe.
   */
  public static async getMapProjects(county?: string, status?: string) {
    const conditions: string[] = [`(p."PublicationStatus" = 'Published' OR p."IsPublished" = TRUE)`]
    const params: SqlParam[] = []

    if (county && county !== 'All') {
      conditions.push('LOWER(pl."County") = LOWER(@county)')
      params.push({ name: 'county', value: county })
    }

    if (status && status !== 'All') {
      conditions.push('p."ProjectStatus" = @status')
      params.push({ name: 'status', value: status })
    }

    const where = `WHERE ${conditions.join(' AND ')}`

    return query(
      `SELECT
        p."ProjectId", p."ProjectCode", p."ProjectName", p."Slug",
        p."ShortDescription", p."ProjectStatus",
        p."IsFeatured", p."PublicationStatus", p."IsPublished",
        p."StartDate", p."ExpectedCompletionDate", p."CompletionDate",
        p."ProjectCost", p."CurrencyCode", p."LengthKm",
        COALESCE(pl."LocationId", 1)               AS "LocationId",
        COALESCE(pl."LocationName", p."ProjectName") AS "LocationName",
        COALESCE(pl."County", 'Nairobi')           AS "County",
        COALESCE(pl."SubCounty", '')               AS "SubCounty",
        pl."Ward",
        COALESCE(pl."Latitude", -1.286389)         AS "Latitude",
        COALESCE(pl."Longitude", 36.817222)        AS "Longitude",
        -- Latest published progress reading
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
        ) AS "HasRoute"
      FROM "Projects" p
      LEFT JOIN LATERAL (
        SELECT l."LocationId", l."LocationName", l."County", l."SubCounty",
               l."Ward", l."Latitude", l."Longitude"
        FROM "ProjectLocations" l
        WHERE l."ProjectId" = p."ProjectId"
        ORDER BY l."IsPrimaryLocation" DESC, l."LocationId" ASC
        LIMIT 1
      ) pl ON TRUE
      ${where}
      ORDER BY p."IsFeatured" DESC, p."CreatedAt" DESC`,
      params
    )
  }

  /**
   * Per-county project statistics.
   * Returns: County, Total, Ongoing, Completed, Planned, Suspended
   */
  public static async getCountyStats() {
    return query(
      `SELECT
        COALESCE(pl."County", 'Unknown')     AS "County",
        COUNT(DISTINCT p."ProjectId")::int   AS "Total",
        COUNT(*) FILTER (WHERE p."ProjectStatus" = 'Ongoing')::int   AS "Ongoing",
        COUNT(*) FILTER (WHERE p."ProjectStatus" = 'Completed')::int AS "Completed",
        COUNT(*) FILTER (WHERE p."ProjectStatus" = 'Planned')::int   AS "Planned",
        COUNT(*) FILTER (WHERE p."ProjectStatus" = 'Suspended')::int AS "Suspended"
      FROM "Projects" p
      LEFT JOIN "ProjectLocations" pl
        ON p."ProjectId" = pl."ProjectId"
       AND pl."IsPrimaryLocation" = TRUE
      WHERE (p."PublicationStatus" = 'Published' OR p."IsPublished" = TRUE)
      GROUP BY pl."County"
      ORDER BY "Total" DESC`
    )
  }

  /** GeoJSON route for a specific project. */
  public static async getProjectRoute(projectId: number) {
    return queryOne<{ RouteId: number; RouteName: string | null; GeometryType: string; GeoJson: string | null }>(
      `SELECT "RouteId", "RouteName", "GeometryType", "GeoJson"
       FROM "ProjectRoutes"
       WHERE "ProjectId" = @projectId
       ORDER BY "RouteId" ASC
       LIMIT 1`,
      [{ name: 'projectId', value: projectId }]
    )
  }

  /** All project routes, for map preloading. */
  public static async getAllProjectRoutes() {
    return query(
      `SELECT
        pr."RouteId", pr."ProjectId", pr."RouteName", pr."GeometryType", pr."GeoJson",
        p."ProjectStatus"
      FROM "ProjectRoutes" pr
      INNER JOIN "Projects" p ON p."ProjectId" = pr."ProjectId"
      WHERE pr."GeoJson" IS NOT NULL
        AND (p."PublicationStatus" = 'Published' OR p."IsPublished" = TRUE)`
    )
  }

  /** @deprecated Use getMapProjects() */
  public static async getProjectSummaries() {
    return query(`SELECT * FROM "vw_ProjectSummary"`)
  }
}
