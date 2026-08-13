import { VRRepository } from './vr.repository.js'
import type { VRProjectSettingsRow, VRHotspotRow } from './vr.repository.js'

export class VRService {
  public static async getVRDetails(projectId: number) {
    const settings = await VRRepository.getSettings(projectId)
    const hotspots = await VRRepository.getHotspots(projectId)
    return { settings, hotspots }
  }

  public static async updateVRSettings(projectId: number, settings: Partial<VRProjectSettingsRow>) {
    return VRRepository.updateSettings(projectId, settings)
  }

  public static async createHotspot(hotspot: Partial<VRHotspotRow>) {
    return VRRepository.createHotspot(hotspot)
  }
}
