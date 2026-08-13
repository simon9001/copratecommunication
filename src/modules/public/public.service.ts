import { query } from '../../db/query.js'

export class PublicService {
  public static async getMapProjects() {
    return query(`
      SELECT 
        p.ProjectId, p.ProjectCode, p.ProjectName, p.Slug, p.ShortDescription, p.ProjectStatus, p.IsFeatured, p.PublicationStatus, p.IsPublished,
        ISNULL(pl.LocationId, 1) AS LocationId,
        ISNULL(pl.LocationName, p.ProjectName) AS LocationName,
        ISNULL(pl.County, 'Nairobi') AS County,
        ISNULL(pl.SubCounty, 'Central') AS SubCounty,
        pl.Ward,
        ISNULL(pl.Latitude, -1.286389) AS Latitude,
        ISNULL(pl.Longitude, 36.817222) AS Longitude
      FROM Projects p
      LEFT JOIN ProjectLocations pl 
        ON p.ProjectId = pl.ProjectId 
        AND (pl.IsPrimaryLocation = 1 OR pl.LocationId = (SELECT MIN(LocationId) FROM ProjectLocations WHERE ProjectId = p.ProjectId))
    `)
  }

  public static async getProjectSummaries() {
    return query(`
      SELECT *
      FROM vw_ProjectSummary
    `)
  }
}
