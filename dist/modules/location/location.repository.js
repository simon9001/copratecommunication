import { execute, query, queryOne } from '../../db/query.js';
import { NotFoundError } from '../../errors/AppError.js';
const LOCATION_COLUMNS = `"LocationId", "ProjectId", "LocationName", "County", "SubCounty",
  "Ward", "Address", "Latitude", "Longitude", "IsPrimaryLocation", "CreatedAt"`;
export class LocationRepository {
    static async findByProjectId(projectId) {
        return query(`SELECT ${LOCATION_COLUMNS} FROM "ProjectLocations"
       WHERE "ProjectId" = @projectId
       ORDER BY "IsPrimaryLocation" DESC`, [{ name: 'projectId', value: projectId }]);
    }
    static async findById(locationId) {
        return queryOne(`SELECT ${LOCATION_COLUMNS} FROM "ProjectLocations" WHERE "LocationId" = @locationId`, [{ name: 'locationId', value: locationId }]);
    }
    static async create(dto) {
        if (dto.isPrimaryLocation) {
            await execute('UPDATE "ProjectLocations" SET "IsPrimaryLocation" = FALSE WHERE "ProjectId" = @projectId', [
                { name: 'projectId', value: dto.projectId },
            ]);
        }
        const result = await execute(`INSERT INTO "ProjectLocations" (
        "ProjectId", "LocationName", "County", "SubCounty", "Ward", "Address",
        "Latitude", "Longitude", "IsPrimaryLocation"
      )
      VALUES (
        @projectId, @locationName, @county, @subCounty, @ward, @address,
        @latitude, @longitude, @isPrimaryLocation
      )
      RETURNING ${LOCATION_COLUMNS}`, [
            { name: 'projectId', value: dto.projectId },
            { name: 'locationName', value: dto.locationName || null },
            { name: 'county', value: dto.county },
            { name: 'subCounty', value: dto.subCounty || null },
            { name: 'ward', value: dto.ward || null },
            { name: 'address', value: dto.address || null },
            { name: 'latitude', value: dto.latitude },
            { name: 'longitude', value: dto.longitude },
            { name: 'isPrimaryLocation', value: Boolean(dto.isPrimaryLocation) },
        ]);
        return result.recordset?.[0];
    }
    static async update(locationId, dto) {
        const existing = await this.findById(locationId);
        if (!existing) {
            throw new NotFoundError(`Location with ID ${locationId} not found`);
        }
        if (dto.isPrimaryLocation) {
            await execute('UPDATE "ProjectLocations" SET "IsPrimaryLocation" = FALSE WHERE "ProjectId" = @projectId', [
                { name: 'projectId', value: existing.ProjectId },
            ]);
        }
        // Each parameter is cast explicitly: COALESCE over an untyped NULL
        // placeholder leaves Postgres unable to resolve the argument types.
        await execute(`UPDATE "ProjectLocations"
       SET "LocationName"      = COALESCE(@locationName::text, "LocationName"),
           "County"            = COALESCE(@county::text, "County"),
           "SubCounty"         = COALESCE(@subCounty::text, "SubCounty"),
           "Ward"              = COALESCE(@ward::text, "Ward"),
           "Address"           = COALESCE(@address::text, "Address"),
           "Latitude"          = COALESCE(@latitude::numeric, "Latitude"),
           "Longitude"         = COALESCE(@longitude::numeric, "Longitude"),
           "IsPrimaryLocation" = COALESCE(@isPrimaryLocation::boolean, "IsPrimaryLocation")
       WHERE "LocationId" = @locationId`, [
            { name: 'locationId', value: locationId },
            { name: 'locationName', value: dto.locationName || null },
            { name: 'county', value: dto.county || null },
            { name: 'subCounty', value: dto.subCounty || null },
            { name: 'ward', value: dto.ward || null },
            { name: 'address', value: dto.address || null },
            { name: 'latitude', value: dto.latitude ?? null },
            { name: 'longitude', value: dto.longitude ?? null },
            { name: 'isPrimaryLocation', value: dto.isPrimaryLocation ?? null },
        ]);
        return (await this.findById(locationId));
    }
    static async delete(locationId) {
        const existing = await this.findById(locationId);
        if (!existing) {
            throw new NotFoundError(`Location with ID ${locationId} not found`);
        }
        await execute('DELETE FROM "ProjectLocations" WHERE "LocationId" = @locationId', [
            { name: 'locationId', value: locationId },
        ]);
    }
}
