import { query } from '../../db/query.js'

export class PublicService {
  public static async getMapProjects() {
    return query(`
      SELECT
        ProjectId, ProjectCode, ProjectName, Slug, ShortDescription, ProjectStatus, IsFeatured,
        LocationId, LocationName, County, SubCounty, Ward, Latitude, Longitude
      FROM vw_PublicProjectMap
    `)
  }

  public static async getProjectSummaries() {
    return query(`
      SELECT *
      FROM vw_ProjectSummary
      WHERE IsPublished = 1 AND PublicationStatus = 'Published'
    `)
  }
}
