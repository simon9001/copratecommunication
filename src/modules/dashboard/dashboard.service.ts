import { DashboardRepository } from './dashboard.repository.js'

export class DashboardService {
  public static async getOverview() {
    const [totals, counties, activity, missingMedia] = await Promise.all([
      DashboardRepository.getTotals(),
      DashboardRepository.getCountyBreakdown(),
      DashboardRepository.getRecentActivity(),
      DashboardRepository.getProjectsMissingMedia(),
    ])

    return {
      totals: {
        totalProjects: totals.TotalProjects ?? 0,
        published: totals.Published ?? 0,
        drafts: totals.Drafts ?? 0,
        ongoing: totals.Ongoing ?? 0,
        completed: totals.Completed ?? 0,
        planned: totals.Planned ?? 0,
        totalCost: Number(totals.TotalCost ?? 0),
        totalLengthKm: Number(totals.TotalLengthKm ?? 0),
        countiesCovered: totals.CountiesCovered ?? 0,
        mediaCount: totals.MediaCount ?? 0,
        videoCount: totals.VideoCount ?? 0,
        categoryCount: totals.CategoryCount ?? 0,
      },
      counties: counties.map((c) => ({
        county: c.County,
        projectCount: c.ProjectCount,
      })),
      recentActivity: activity.map((a) => ({
        projectId: a.ProjectId,
        projectName: a.ProjectName,
        projectCode: a.ProjectCode,
        action: a.Action,
        fromStatus: a.FromStatus,
        toStatus: a.ToStatus,
        performedAt: a.PerformedAt,
      })),
      needsAttention: missingMedia.map((p) => ({
        projectId: p.ProjectId,
        projectName: p.ProjectName,
        projectCode: p.ProjectCode,
        reason: 'No photos or videos attached yet',
      })),
    }
  }
}
