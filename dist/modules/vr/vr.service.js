import { VRRepository } from './vr.repository.js';
export class VRService {
    static async getVRDetails(projectId) {
        const settings = await VRRepository.getSettings(projectId);
        const hotspots = await VRRepository.getHotspots(projectId);
        return { settings, hotspots };
    }
    static async updateVRSettings(projectId, settings) {
        return VRRepository.updateSettings(projectId, settings);
    }
    static async createHotspot(hotspot) {
        return VRRepository.createHotspot(hotspot);
    }
}
