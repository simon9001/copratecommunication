import { execute, query } from './query.js';
import { seedDemoProjects } from './seed.js';
import { closeDbPool } from './connection.js';
async function fixAndPublishProjects() {
    console.log('Publishing and attaching locations to all projects...');
    // Add the sample projects first if they are not there yet
    await seedDemoProjects();
    // Set every project to Published
    await execute(`
    UPDATE "Projects"
    SET "PublicationStatus" = 'Published', "IsPublished" = TRUE
    WHERE "PublicationStatus" = 'Draft' OR "IsPublished" = FALSE
  `);
    // Ensure every project has a location record, or it cannot appear on the globe
    const projectsWithoutLocations = await query(`
    SELECT p."ProjectId", p."ProjectName"
    FROM "Projects" p
    WHERE NOT EXISTS (SELECT 1 FROM "ProjectLocations" pl WHERE pl."ProjectId" = p."ProjectId")
  `);
    for (const p of projectsWithoutLocations) {
        console.log(`Adding location record for Project ID ${p.ProjectId}: ${p.ProjectName}`);
        await execute(`INSERT INTO "ProjectLocations" (
        "ProjectId", "LocationName", "County", "SubCounty", "Latitude", "Longitude", "IsPrimaryLocation"
      ) VALUES (
        @projectId, @name, 'Nairobi', 'Starehe', -1.286389, 36.817222, TRUE
      )`, [
            { name: 'projectId', value: p.ProjectId },
            { name: 'name', value: p.ProjectName },
        ]);
    }
    console.log('✅ All projects published and linked to map locations successfully!');
    await closeDbPool();
}
fixAndPublishProjects().catch(async (err) => {
    console.error(err);
    await closeDbPool();
    process.exit(1);
});
