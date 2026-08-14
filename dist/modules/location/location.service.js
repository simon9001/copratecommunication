import { LocationRepository } from './location.repository.js';
export class LocationService {
    static async getLocationsByProject(projectId) {
        return LocationRepository.findByProjectId(projectId);
    }
    static async createLocation(dto) {
        return LocationRepository.create(dto);
    }
    static async updateLocation(locationId, dto) {
        return LocationRepository.update(locationId, dto);
    }
    static async deleteLocation(locationId) {
        return LocationRepository.delete(locationId);
    }
}
