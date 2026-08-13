import { execute, queryOne } from './query.js'
import { logger } from '../services/logger.service.js'

export async function seedDemoProjects() {
  try {
    logger.info('[Seed] Checking and seeding sample KeNHA highway projects into SQL Server...')

    const projectsData = [
      {
        code: 'KEN-EXP-001',
        name: 'Nairobi Expressway',
        slug: 'nairobi-expressway',
        shortDesc: 'A 27.1 km, 4-lane access-controlled highway connecting Westlands to Mlolongo via JKIA.',
        fullDesc: 'The Nairobi Expressway is a flagship infrastructure project undertaken by KeNHA to decongest Nairobi CBD and provide seamless connectivity between JKIA and Westlands.',
        status: 'Completed',
        publicationStatus: 'Published',
        cost: 88000000000,
        lengthKm: 27.1,
        isFeatured: 1,
        isPublished: 1,
        county: 'Nairobi',
        subCounty: 'Starehe',
        lat: -1.286389,
        lng: 36.817222,
      },
      {
        code: 'KEN-BYP-002',
        name: 'Dongo Kundu Bypass',
        slug: 'dongo-kundu-bypass',
        shortDesc: 'Mombasa Southern Bypass connecting Miritini to Likoni and Kwale county.',
        fullDesc: 'The Dongo Kundu Bypass project provides a vital link bypassing the busy Likoni Ferry, boosting trade and tourism along the coastal corridor.',
        status: 'Ongoing',
        publicationStatus: 'Published',
        cost: 25000000000,
        lengthKm: 17.5,
        isFeatured: 1,
        isPublished: 1,
        county: 'Mombasa',
        subCounty: 'Likoni',
        lat: -4.083333,
        lng: 39.6,
      },
      {
        code: 'KEN-HWY-003',
        name: 'Kenol-Marua Dual Carriageway',
        slug: 'kenol-marua-dual-carriageway',
        shortDesc: 'Dualing of 84 km A2 highway from Kenol through Murang\'a to Marua in Nyeri.',
        fullDesc: 'Part of the Great North Road corridor (LAPSSET integration), expanding the 2-lane highway to a 4-lane dual carriageway.',
        status: 'Ongoing',
        publicationStatus: 'Published',
        cost: 16000000000,
        lengthKm: 84.0,
        isFeatured: 1,
        isPublished: 1,
        county: 'Murang\'a',
        subCounty: 'Kenol',
        lat: -0.716667,
        lng: 37.15,
      },
      {
        code: 'KEN-RD-004',
        name: 'Mau Mau Cluster Roads',
        slug: 'mau-mau-cluster-roads',
        shortDesc: '540 km road network traversing Kiambu, Murang\'a, Nyeri, and Nyandarua counties.',
        fullDesc: 'Historical Mau Mau road network upgrades improving agricultural transport across the Aberdare mountain region.',
        status: 'Ongoing',
        publicationStatus: 'Published',
        cost: 30000000000,
        lengthKm: 540.0,
        isFeatured: 1,
        isPublished: 1,
        county: 'Nyeri',
        subCounty: 'Tetu',
        lat: -0.416667,
        lng: 36.95,
      },
      {
        code: 'KEN-BYP-005',
        name: 'Nairobi Southern Bypass',
        slug: 'nairobi-southern-bypass',
        shortDesc: '28.6 km bypass connecting Kikuyu to Mombasa Road through Langata.',
        fullDesc: 'Diverts heavy transit commercial trucks away from Nairobi City Center, dramatically improving air quality and traffic flow.',
        status: 'Completed',
        publicationStatus: 'Published',
        cost: 18000000000,
        lengthKm: 28.6,
        isFeatured: 0,
        isPublished: 1,
        county: 'Nairobi',
        subCounty: 'Langata',
        lat: -1.333333,
        lng: 36.75,
      },
    ]

    for (const p of projectsData) {
      const existing = await queryOne('SELECT ProjectId FROM Projects WHERE ProjectCode = @code OR Slug = @slug', [
        { name: 'code', value: p.code },
        { name: 'slug', value: p.slug },
      ])

      if (existing) {
        // Ensure published status
        await execute(
          "UPDATE Projects SET PublicationStatus = 'Published', IsPublished = 1 WHERE ProjectId = @id",
          [{ name: 'id', value: existing.ProjectId }]
        )

        // Ensure primary location exists
        const locExisting = await queryOne('SELECT LocationId FROM ProjectLocations WHERE ProjectId = @projectId', [
          { name: 'projectId', value: existing.ProjectId },
        ])
        if (!locExisting) {
          await execute(
            `INSERT INTO ProjectLocations (
              ProjectId, LocationName, County, SubCounty, Latitude, Longitude, IsPrimaryLocation
            ) VALUES (
              @projectId, @name, @county, @subCounty, @lat, @lng, 1
            )`,
            [
              { name: 'projectId', value: existing.ProjectId },
              { name: 'name', value: p.name },
              { name: 'county', value: p.county },
              { name: 'subCounty', value: p.subCounty },
              { name: 'lat', value: p.lat },
              { name: 'lng', value: p.lng },
            ]
          )
        }
        continue
      }

      const projRes = await execute(
        `INSERT INTO Projects (
          ProjectCode, ProjectName, Slug, ShortDescription, FullDescription,
          ProjectStatus, PublicationStatus, ProjectCost, CurrencyCode, LengthKm, IsFeatured, IsPublished
        )
        OUTPUT INSERTED.ProjectId
        VALUES (
          @code, @name, @slug, @shortDesc, @fullDesc,
          @status, @pubStatus, @cost, 'KES', @length, @isFeatured, @isPublished
        )`,
        [
          { name: 'code', value: p.code },
          { name: 'name', value: p.name },
          { name: 'slug', value: p.slug },
          { name: 'shortDesc', value: p.shortDesc },
          { name: 'fullDesc', value: p.fullDesc },
          { name: 'status', value: p.status },
          { name: 'pubStatus', value: p.publicationStatus },
          { name: 'cost', value: p.cost },
          { name: 'length', value: p.lengthKm },
          { name: 'isFeatured', value: p.isFeatured },
          { name: 'isPublished', value: p.isPublished },
        ]
      )

      const projectId = projRes.recordset?.[0]?.ProjectId

      if (projectId) {
        await execute(
          `INSERT INTO ProjectLocations (
            ProjectId, LocationName, County, SubCounty, Latitude, Longitude, IsPrimaryLocation
          )
          VALUES (
            @projectId, @locName, @county, @subCounty, @lat, @lng, 1
          )`,
          [
            { name: 'projectId', value: projectId },
            { name: 'locName', value: p.name },
            { name: 'county', value: p.county },
            { name: 'subCounty', value: p.subCounty },
            { name: 'lat', value: p.lat },
            { name: 'lng', value: p.lng },
          ]
        )

        await execute('INSERT INTO VRProjectSettings (ProjectId) VALUES (@projectId)', [{ name: 'projectId', value: projectId }])
      }
    }

    logger.info('[Seed] Successfully verified and seeded KeNHA highway projects with GPS coordinates.')
  } catch (err: any) {
    logger.error('[Seed Error] Failed to seed demo projects:', err)
  }
}
