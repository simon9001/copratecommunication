import { query, queryOne } from '../../db/query.js'
import { buildMapProjectsQuery, type MapProjectFilters } from './public.sql.js'

export class PublicService {
  /**
   * All published map projects, with optional county, status and
   * show-highlight filters. This is the visitor-facing feed that drives the globe.
   */
  public static async getMapProjects(filters: MapProjectFilters = {}) {
    const { sql, params } = buildMapProjectsQuery(filters)
    return query(sql, params)
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
