import { execute, query, queryOne } from '../../db/query.js'

export interface VRProjectSettingsRow {
  VRProjectSettingId: number
  ProjectId: number
  MarkerColor: string
  MarkerSize: number
  FlyToAltitude: number | null
  FlyToDurationSeconds: number
  PanelPosition: string
  AutoPlayFeaturedVideo: boolean
  EnableVR: boolean
  EnableFullscreenVideo: boolean
  CreatedAt: string
  UpdatedAt: string
}

export interface VRHotspotRow {
  HotspotId: number
  ProjectId: number
  Title: string
  Description: string | null
  PositionX: number | null
  PositionY: number | null
  PositionZ: number | null
  ActionType: string
  TargetMediaId: number | null
  IsActive: boolean
  CreatedAt: string
}

export class VRRepository {
  public static async getSettings(projectId: number): Promise<VRProjectSettingsRow | null> {
    return queryOne<VRProjectSettingsRow>('SELECT * FROM "VRProjectSettings" WHERE "ProjectId" = @projectId', [
      { name: 'projectId', value: projectId },
    ])
  }

  public static async updateSettings(
    projectId: number,
    settings: Partial<VRProjectSettingsRow>
  ): Promise<VRProjectSettingsRow> {
    await execute(
      `UPDATE "VRProjectSettings"
       SET "MarkerColor"           = COALESCE(@markerColor::text, "MarkerColor"),
           "MarkerSize"            = COALESCE(@markerSize::numeric, "MarkerSize"),
           "FlyToAltitude"         = COALESCE(@flyToAltitude::numeric, "FlyToAltitude"),
           "FlyToDurationSeconds"  = COALESCE(@flyToDurationSeconds::numeric, "FlyToDurationSeconds"),
           "PanelPosition"         = COALESCE(@panelPosition::text, "PanelPosition"),
           "AutoPlayFeaturedVideo" = COALESCE(@autoPlayFeaturedVideo::boolean, "AutoPlayFeaturedVideo"),
           "EnableVR"              = COALESCE(@enableVR::boolean, "EnableVR"),
           "EnableFullscreenVideo" = COALESCE(@enableFullscreenVideo::boolean, "EnableFullscreenVideo")
       WHERE "ProjectId" = @projectId`,
      [
        { name: 'projectId', value: projectId },
        { name: 'markerColor', value: settings.MarkerColor || null },
        { name: 'markerSize', value: settings.MarkerSize ?? null },
        { name: 'flyToAltitude', value: settings.FlyToAltitude ?? null },
        { name: 'flyToDurationSeconds', value: settings.FlyToDurationSeconds ?? null },
        { name: 'panelPosition', value: settings.PanelPosition || null },
        { name: 'autoPlayFeaturedVideo', value: settings.AutoPlayFeaturedVideo ?? null },
        { name: 'enableVR', value: settings.EnableVR ?? null },
        { name: 'enableFullscreenVideo', value: settings.EnableFullscreenVideo ?? null },
      ]
    )

    return (await this.getSettings(projectId))!
  }

  public static async getHotspots(projectId: number): Promise<VRHotspotRow[]> {
    return query<VRHotspotRow>('SELECT * FROM "VRHotspots" WHERE "ProjectId" = @projectId AND "IsActive" = TRUE', [
      { name: 'projectId', value: projectId },
    ])
  }

  public static async createHotspot(hotspot: Partial<VRHotspotRow>): Promise<VRHotspotRow> {
    const res = await execute(
      `INSERT INTO "VRHotspots" (
        "ProjectId", "Title", "Description", "PositionX", "PositionY", "PositionZ", "ActionType", "TargetMediaId"
      )
      VALUES (
        @projectId, @title, @description, @positionX, @positionY, @positionZ, @actionType, @targetMediaId
      )
      RETURNING *`,
      [
        { name: 'projectId', value: hotspot.ProjectId },
        { name: 'title', value: hotspot.Title },
        { name: 'description', value: hotspot.Description || null },
        { name: 'positionX', value: hotspot.PositionX ?? null },
        { name: 'positionY', value: hotspot.PositionY ?? null },
        { name: 'positionZ', value: hotspot.PositionZ ?? null },
        { name: 'actionType', value: hotspot.ActionType || 'INFO' },
        { name: 'targetMediaId', value: hotspot.TargetMediaId || null },
      ]
    )

    return res.recordset?.[0] as VRHotspotRow
  }
}
