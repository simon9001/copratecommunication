import { execute, query, queryOne } from '../../db/query.js';
export class VRRepository {
    static async getSettings(projectId) {
        return queryOne('SELECT * FROM VRProjectSettings WHERE ProjectId = @projectId', [
            { name: 'projectId', value: projectId },
        ]);
    }
    static async updateSettings(projectId, settings) {
        await execute(`UPDATE VRProjectSettings
       SET MarkerColor = ISNULL(@markerColor, MarkerColor),
           MarkerSize = ISNULL(@markerSize, MarkerSize),
           FlyToAltitude = ISNULL(@flyToAltitude, FlyToAltitude),
           FlyToDurationSeconds = ISNULL(@flyToDurationSeconds, FlyToDurationSeconds),
           PanelPosition = ISNULL(@panelPosition, PanelPosition),
           AutoPlayFeaturedVideo = ISNULL(@autoPlayFeaturedVideo, AutoPlayFeaturedVideo),
           EnableVR = ISNULL(@enableVR, EnableVR),
           EnableFullscreenVideo = ISNULL(@enableFullscreenVideo, EnableFullscreenVideo),
           UpdatedAt = SYSUTCDATETIME()
       WHERE ProjectId = @projectId`, [
            { name: 'projectId', value: projectId },
            { name: 'markerColor', value: settings.MarkerColor || null },
            { name: 'markerSize', value: settings.MarkerSize ?? null },
            { name: 'flyToAltitude', value: settings.FlyToAltitude ?? null },
            { name: 'flyToDurationSeconds', value: settings.FlyToDurationSeconds ?? null },
            { name: 'panelPosition', value: settings.PanelPosition || null },
            { name: 'autoPlayFeaturedVideo', value: settings.AutoPlayFeaturedVideo !== undefined ? (settings.AutoPlayFeaturedVideo ? 1 : 0) : null },
            { name: 'enableVR', value: settings.EnableVR !== undefined ? (settings.EnableVR ? 1 : 0) : null },
            { name: 'enableFullscreenVideo', value: settings.EnableFullscreenVideo !== undefined ? (settings.EnableFullscreenVideo ? 1 : 0) : null },
        ]);
        return (await this.getSettings(projectId));
    }
    static async getHotspots(projectId) {
        return query('SELECT * FROM VRHotspots WHERE ProjectId = @projectId AND IsActive = 1', [
            { name: 'projectId', value: projectId },
        ]);
    }
    static async createHotspot(hotspot) {
        const res = await execute(`INSERT INTO VRHotspots (
        ProjectId, Title, Description, PositionX, PositionY, PositionZ, ActionType, TargetMediaId
      )
      OUTPUT INSERTED.*
      VALUES (
        @projectId, @title, @description, @positionX, @positionY, @positionZ, @actionType, @targetMediaId
      )`, [
            { name: 'projectId', value: hotspot.ProjectId },
            { name: 'title', value: hotspot.Title },
            { name: 'description', value: hotspot.Description || null },
            { name: 'positionX', value: hotspot.PositionX ?? null },
            { name: 'positionY', value: hotspot.PositionY ?? null },
            { name: 'positionZ', value: hotspot.PositionZ ?? null },
            { name: 'actionType', value: hotspot.ActionType || 'INFO' },
            { name: 'targetMediaId', value: hotspot.TargetMediaId || null },
        ]);
        return res.recordset?.[0];
    }
}
