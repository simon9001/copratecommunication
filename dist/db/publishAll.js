import { execute, query } from './query.js';
import { seedDemoProjects } from './seed.js';
async function fixAndPublishProjects() {
    console.log('Publishing and attaching locations to all projects...');
    // First run seed to add sample projects if needed
    await seedDemoProjects();
    // Set all projects to Published
    await execute(`
    UPDATE Projects 
    SET PublicationStatus = 'Published', IsPublished = 1 
    WHERE PublicationStatus = 'Draft' OR IsPublished = 0
  `);
    // Ensure every project has a location record
    const projectsWithoutLocations = await query(`
    SELECT p.ProjectId, p.ProjectName 
    FROM Projects p 
    WHERE NOT EXISTS (SELECT 1 FROM ProjectLocations pl WHERE pl.ProjectId = p.ProjectId)
  `);
    for (const p of projectsWithoutLocations) {
        console.log(`Adding location record for Project ID ${p.ProjectId}: ${p.ProjectName}`);
        await execute(`INSERT INTO ProjectLocations (
        ProjectId, LocationName, County, SubCounty, Latitude, Longitude, IsPrimaryLocation
      ) VALUES (
        @projectId, @name, 'Nairobi', 'Starehe', -1.286389, 36.817222, 1
      )`, [
            { name: 'projectId', value: p.ProjectId },
            { name: 'name', value: p.ProjectName },
        ]);
    }
    console.log('✅ All projects published and linked to map locations successfully!');
    process.exit(0);
}
fixAndPublishProjects().catch(console.error);
