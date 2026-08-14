import { query, queryOne } from '../../db/query.js'

export class PublicService {
  /**
   * Get all published map projects, with optional county and status filters.
   */
  public static async getMapProjects(county?: string, status?: string) {
    const conditions: string[] = ['(p.PublicationStatus = \'Published\' OR p.IsPublished = 1)']
    const params: { name: string; value: unknown }[] = []

    if (county && county !== 'All') {
      conditions.push('LOWER(pl.County) = LOWER(@county)')
      params.push({ name: 'county', value: county })
    }

    if (status && status !== 'All') {
      conditions.push('p.ProjectStatus = @status')
      params.push({ name: 'status', value: status })
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    return query(
      `SELECT
        p.ProjectId, p.ProjectCode, p.ProjectName, p.Slug,
        p.ShortDescription, p.ProjectStatus,
        p.IsFeatured, p.PublicationStatus, p.IsPublished,
        p.StartDate, p.ExpectedCompletionDate, p.CompletionDate,
        p.ProjectCost, p.CurrencyCode, p.LengthKm,
        ISNULL(pl.LocationId, 1)             AS LocationId,
        ISNULL(pl.LocationName, p.ProjectName) AS LocationName,
        ISNULL(pl.County, 'Nairobi')         AS County,
        ISNULL(pl.SubCounty, '')             AS SubCounty,
        pl.Ward,
        ISNULL(pl.Latitude, -1.286389)       AS Latitude,
        ISNULL(pl.Longitude, 36.817222)      AS Longitude,
        -- Latest progress from updates
        (
          SELECT TOP 1 pu.ProgressPercentage
          FROM ProjectUpdates pu
          WHERE pu.ProjectId = p.ProjectId
            AND pu.PublicationStatus = 'Published'
          ORDER BY pu.UpdateDate DESC
        ) AS ProgressPercentage,
        -- Route flag
        CASE WHEN EXISTS (
          SELECT 1 FROM ProjectRoutes pr WHERE pr.ProjectId = p.ProjectId
        ) THEN 1 ELSE 0 END AS HasRoute
      FROM Projects p
      LEFT JOIN ProjectLocations pl
        ON p.ProjectId = pl.ProjectId
        AND (
          pl.IsPrimaryLocation = 1
          OR pl.LocationId = (
            SELECT MIN(LocationId)
            FROM ProjectLocations
            WHERE ProjectId = p.ProjectId
          )
        )
      ${where}
      ORDER BY p.IsFeatured DESC, p.CreatedAt DESC`,
      params as never
    )
  }

  /**
   * Get per-county project statistics.
   * Returns: County, Total, Ongoing, Completed, Planned, Suspended
   */
  public static async getCountyStats() {
    return query(
      `SELECT
        ISNULL(pl.County, 'Unknown') AS County,
        COUNT(DISTINCT p.ProjectId)  AS Total,
        SUM(CASE WHEN p.ProjectStatus = 'Ongoing'   THEN 1 ELSE 0 END) AS Ongoing,
        SUM(CASE WHEN p.ProjectStatus = 'Completed' THEN 1 ELSE 0 END) AS Completed,
        SUM(CASE WHEN p.ProjectStatus = 'Planned'   THEN 1 ELSE 0 END) AS Planned,
        SUM(CASE WHEN p.ProjectStatus = 'Suspended' THEN 1 ELSE 0 END) AS Suspended
      FROM Projects p
      LEFT JOIN ProjectLocations pl
        ON p.ProjectId = pl.ProjectId
        AND pl.IsPrimaryLocation = 1
      WHERE (p.PublicationStatus = 'Published' OR p.IsPublished = 1)
      GROUP BY pl.County
      ORDER BY Total DESC`
    )
  }

  /**
   * Get GeoJSON route for a specific project.
   */
  public static async getProjectRoute(projectId: number) {
    return queryOne<{ RouteId: number; RouteName: string | null; GeometryType: string; GeoJson: string | null }>(
      `SELECT TOP 1
        RouteId, RouteName, GeometryType, GeoJson
      FROM ProjectRoutes
      WHERE ProjectId = @projectId
      ORDER BY RouteId ASC`,
      [{ name: 'projectId', value: projectId }]
    )
  }

  /**
   * Get all project routes (for map preloading).
   */
  public static async getAllProjectRoutes() {
    return query(
      `SELECT
        pr.RouteId, pr.ProjectId, pr.RouteName, pr.GeometryType, pr.GeoJson,
        p.ProjectStatus
      FROM ProjectRoutes pr
      INNER JOIN Projects p ON p.ProjectId = pr.ProjectId
      WHERE pr.GeoJson IS NOT NULL
        AND (p.PublicationStatus = 'Published' OR p.IsPublished = 1)`,
      []
    )
  }

  /** @deprecated Use getMapProjects() */
  public static async getProjectSummaries() {
    return query(`SELECT * FROM vw_ProjectSummary`)
  }
}
