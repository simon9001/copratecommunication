import { query, queryOne } from '../../db/query.js'

export interface DashboardTotals {
  TotalProjects: number
  Published: number
  Drafts: number
  Ongoing: number
  Completed: number
  Planned: number
  TotalCost: number | null
  TotalLengthKm: number | null
  CountiesCovered: number
  MediaCount: number
  VideoCount: number
  CategoryCount: number
}

export interface RecentActivityRow {
  ProjectId: number
  ProjectName: string
  ProjectCode: string
  Action: string
  FromStatus: string | null
  ToStatus: string | null
  PerformedAt: string
}

export class DashboardRepository {
  /**
   * One round trip for every headline number on the overview. Counting in
   * SQL rather than in the browser keeps the figures correct regardless of
   * how many projects the projects table returns per page.
   */
  public static async getTotals(): Promise<DashboardTotals> {
    const row = await queryOne<DashboardTotals>(`
      SELECT
        (SELECT COUNT(*)::int FROM "Projects")                                            AS "TotalProjects",
        (SELECT COUNT(*)::int FROM "Projects" WHERE "IsPublished" = TRUE)                 AS "Published",
        (SELECT COUNT(*)::int FROM "Projects" WHERE "IsPublished" = FALSE)                AS "Drafts",
        (SELECT COUNT(*)::int FROM "Projects" WHERE "ProjectStatus" = 'Ongoing')          AS "Ongoing",
        (SELECT COUNT(*)::int FROM "Projects" WHERE "ProjectStatus" = 'Completed')        AS "Completed",
        (SELECT COUNT(*)::int FROM "Projects" WHERE "ProjectStatus" = 'Planned')          AS "Planned",
        (SELECT COALESCE(SUM("ProjectCost"), 0) FROM "Projects")                          AS "TotalCost",
        (SELECT COALESCE(SUM("LengthKm"), 0) FROM "Projects")                             AS "TotalLengthKm",
        (SELECT COUNT(DISTINCT "County")::int FROM "ProjectLocations")                    AS "CountiesCovered",
        (SELECT COUNT(*)::int FROM "ProjectMedia")                                        AS "MediaCount",
        (SELECT COUNT(*)::int FROM "ProjectMedia" WHERE "MediaType" LIKE '%VIDEO%')       AS "VideoCount",
        (SELECT COUNT(*)::int FROM "ProjectCategories")                                   AS "CategoryCount"
    `)

    return (
      row ?? {
        TotalProjects: 0,
        Published: 0,
        Drafts: 0,
        Ongoing: 0,
        Completed: 0,
        Planned: 0,
        TotalCost: 0,
        TotalLengthKm: 0,
        CountiesCovered: 0,
        MediaCount: 0,
        VideoCount: 0,
        CategoryCount: 0,
      }
    )
  }

  /** Project count per county, for the overview distribution bars. */
  public static async getCountyBreakdown() {
    return query<{ County: string; ProjectCount: number }>(`
      SELECT pl."County", COUNT(DISTINCT pl."ProjectId")::int AS "ProjectCount"
      FROM "ProjectLocations" pl
      WHERE pl."County" IS NOT NULL
      GROUP BY pl."County"
      ORDER BY COUNT(DISTINCT pl."ProjectId") DESC
      LIMIT 8
    `)
  }

  /** The Editor's own recent changes, newest first. */
  public static async getRecentActivity() {
    return query<RecentActivityRow>(`
      SELECT
        w."ProjectId",
        p."ProjectName",
        p."ProjectCode",
        w."Action",
        w."FromStatus",
        w."ToStatus",
        w."PerformedAt"
      FROM "ProjectWorkflow" w
      INNER JOIN "Projects" p ON p."ProjectId" = w."ProjectId"
      ORDER BY w."PerformedAt" DESC
      LIMIT 10
    `)
  }

  /** Projects that still have no photo or video attached. */
  public static async getProjectsMissingMedia() {
    return query<{ ProjectId: number; ProjectName: string; ProjectCode: string }>(`
      SELECT p."ProjectId", p."ProjectName", p."ProjectCode"
      FROM "Projects" p
      WHERE NOT EXISTS (
        SELECT 1 FROM "ProjectMedia" m WHERE m."ProjectId" = p."ProjectId"
      )
      ORDER BY p."CreatedAt" DESC
      LIMIT 10
    `)
  }
}
