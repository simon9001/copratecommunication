import { execute, query, queryOne } from '../../db/query.js'
import { NotFoundError } from '../../errors/AppError.js'
import type { CreateLocationDto, UpdateLocationDto } from './location.schema.js'

export interface LocationRow {
  LocationId: number
  ProjectId: number
  LocationName: string | null
  County: string
  SubCounty: string | null
  Ward: string | null
  Address: string | null
  Latitude: number
  Longitude: number
  IsPrimaryLocation: boolean
  CreatedAt: string
}

export class LocationRepository {
  public static async findByProjectId(projectId: number): Promise<LocationRow[]> {
    return query<LocationRow>(
      'SELECT LocationId, ProjectId, LocationName, County, SubCounty, Ward, Address, Latitude, Longitude, IsPrimaryLocation, CreatedAt FROM ProjectLocations WHERE ProjectId = @projectId ORDER BY IsPrimaryLocation DESC',
      [{ name: 'projectId', value: projectId }]
    )
  }

  public static async findById(locationId: number): Promise<LocationRow | null> {
    return queryOne<LocationRow>(
      'SELECT LocationId, ProjectId, LocationName, County, SubCounty, Ward, Address, Latitude, Longitude, IsPrimaryLocation, CreatedAt FROM ProjectLocations WHERE LocationId = @locationId',
      [{ name: 'locationId', value: locationId }]
    )
  }

  public static async create(dto: CreateLocationDto): Promise<LocationRow> {
    if (dto.isPrimaryLocation) {
      await execute('UPDATE ProjectLocations SET IsPrimaryLocation = 0 WHERE ProjectId = @projectId', [
        { name: 'projectId', value: dto.projectId },
      ])
    }

    const result = await execute(
      `INSERT INTO ProjectLocations (
        ProjectId, LocationName, County, SubCounty, Ward, Address, Latitude, Longitude, IsPrimaryLocation
      )
      OUTPUT INSERTED.LocationId
      VALUES (
        @projectId, @locationName, @county, @subCounty, @ward, @address, @latitude, @longitude, @isPrimaryLocation
      )`,
      [
        { name: 'projectId', value: dto.projectId },
        { name: 'locationName', value: dto.locationName || null },
        { name: 'county', value: dto.county },
        { name: 'subCounty', value: dto.subCounty || null },
        { name: 'ward', value: dto.ward || null },
        { name: 'address', value: dto.address || null },
        { name: 'latitude', value: dto.latitude },
        { name: 'longitude', value: dto.longitude },
        { name: 'isPrimaryLocation', value: dto.isPrimaryLocation ? 1 : 0 },
      ]
    )

    const locationId = result.recordset?.[0]?.LocationId
    return (await this.findById(locationId))!
  }

  public static async update(locationId: number, dto: UpdateLocationDto): Promise<LocationRow> {
    const existing = await this.findById(locationId)
    if (!existing) {
      throw new NotFoundError(`Location with ID ${locationId} not found`)
    }

    if (dto.isPrimaryLocation) {
      await execute('UPDATE ProjectLocations SET IsPrimaryLocation = 0 WHERE ProjectId = @projectId', [
        { name: 'projectId', value: existing.ProjectId },
      ])
    }

    await execute(
      `UPDATE ProjectLocations
       SET LocationName = ISNULL(@locationName, LocationName),
           County = ISNULL(@county, County),
           SubCounty = ISNULL(@subCounty, SubCounty),
           Ward = ISNULL(@ward, Ward),
           Address = ISNULL(@address, Address),
           Latitude = ISNULL(@latitude, Latitude),
           Longitude = ISNULL(@longitude, Longitude),
           IsPrimaryLocation = ISNULL(@isPrimaryLocation, IsPrimaryLocation)
       WHERE LocationId = @locationId`,
      [
        { name: 'locationId', value: locationId },
        { name: 'locationName', value: dto.locationName || null },
        { name: 'county', value: dto.county || null },
        { name: 'subCounty', value: dto.subCounty || null },
        { name: 'ward', value: dto.ward || null },
        { name: 'address', value: dto.address || null },
        { name: 'latitude', value: dto.latitude ?? null },
        { name: 'longitude', value: dto.longitude ?? null },
        { name: 'isPrimaryLocation', value: dto.isPrimaryLocation !== undefined ? (dto.isPrimaryLocation ? 1 : 0) : null },
      ]
    )

    return (await this.findById(locationId))!
  }

  public static async delete(locationId: number): Promise<void> {
    const existing = await this.findById(locationId)
    if (!existing) {
      throw new NotFoundError(`Location with ID ${locationId} not found`)
    }
    await execute('DELETE FROM ProjectLocations WHERE LocationId = @locationId', [{ name: 'locationId', value: locationId }])
  }
}
