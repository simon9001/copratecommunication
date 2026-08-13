import { LocationRepository } from './location.repository.js'
import type { CreateLocationDto, UpdateLocationDto } from './location.schema.js'

export class LocationService {
  public static async getLocationsByProject(projectId: number) {
    return LocationRepository.findByProjectId(projectId)
  }

  public static async createLocation(dto: CreateLocationDto) {
    return LocationRepository.create(dto)
  }

  public static async updateLocation(locationId: number, dto: UpdateLocationDto) {
    return LocationRepository.update(locationId, dto)
  }

  public static async deleteLocation(locationId: number) {
    return LocationRepository.delete(locationId)
  }
}
