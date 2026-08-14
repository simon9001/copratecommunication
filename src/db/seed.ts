import { execute, query, queryOne } from './query.js'
import { logger } from '../services/logger.service.js'
import bcrypt from 'bcryptjs'

export const DEFAULT_USERS = [
  {
    fullName: 'KeNHA Super Administrator',
    email: 'admin@kenha.co.ke',
    password: 'Admin@KeNHA2026!',
    roles: ['Super Administrator'],
    description: 'Master administrative account with unrestricted access across the entire KeNHA system.',
  },
  {
    fullName: 'ICT Systems Administrator',
    email: 'ict.admin@kenha.co.ke',
    password: 'IctAdmin@KeNHA2026!',
    roles: ['ICT Administrator'],
    description: 'Manages users, roles, system health, audit logs, and technical integrations.',
  },
  {
    fullName: 'Corporate Communications Manager',
    email: 'comm.manager@kenha.co.ke',
    password: 'Manager@KeNHA2026!',
    roles: ['Communications Manager'],
    description: 'Authorizes, approves, and publishes official highway projects and public updates.',
  },
  {
    fullName: 'Senior Communications Editor',
    email: 'editor@kenha.co.ke',
    password: 'Editor@KeNHA2026!',
    roles: ['Communications Editor'],
    description: 'Reviews project updates, media uploads, and milestone changes.',
  },
  {
    fullName: 'Communications Officer',
    email: 'officer@kenha.co.ke',
    password: 'Officer@KeNHA2026!',
    roles: ['Communications Officer'],
    description: 'Creates new projects, uploads media, drafts milestone updates, and submits for review.',
  },
  {
    fullName: 'Public Project Observer',
    email: 'viewer@kenha.co.ke',
    password: 'Viewer@KeNHA2026!',
    roles: ['Viewer'],
    description: 'Read-only access to view project analytics and map explorer data.',
  },
]

export const DEFAULT_ROLES = [
  { name: 'Super Administrator', desc: 'Full system and configuration access' },
  { name: 'Communications Officer', desc: 'Create and manage project content and submit it for review' },
  { name: 'Communications Editor', desc: 'Review project content and request changes' },
  { name: 'Communications Manager', desc: 'Approve and publish official project content' },
  { name: 'ICT Administrator', desc: 'Manage users, roles, configuration, integrations and system health' },
  { name: 'Viewer', desc: 'Read-only access to the internal portal' },
]

export const DEFAULT_PERMISSIONS = [
  { code: 'PROJECT_CREATE', desc: 'Create projects' },
  { code: 'PROJECT_VIEW', desc: 'View projects' },
  { code: 'PROJECT_EDIT', desc: 'Edit projects' },
  { code: 'PROJECT_DELETE', desc: 'Delete projects' },
  { code: 'PROJECT_SUBMIT_REVIEW', desc: 'Submit projects for review' },
  { code: 'PROJECT_REVIEW', desc: 'Review projects' },
  { code: 'PROJECT_APPROVE', desc: 'Approve projects' },
  { code: 'PROJECT_PUBLISH', desc: 'Publish projects' },
  { code: 'PROJECT_UNPUBLISH', desc: 'Unpublish projects' },
  { code: 'MEDIA_UPLOAD', desc: 'Upload project media' },
  { code: 'MEDIA_EDIT', desc: 'Edit project media' },
  { code: 'MEDIA_APPROVE', desc: 'Approve project media' },
  { code: 'MEDIA_DELETE', desc: 'Delete project media' },
  { code: 'UPDATE_CREATE', desc: 'Create project updates' },
  { code: 'UPDATE_EDIT', desc: 'Edit project updates' },
  { code: 'UPDATE_APPROVE', desc: 'Approve project updates' },
  { code: 'UPDATE_PUBLISH', desc: 'Publish project updates' },
  { code: 'DOCUMENT_UPLOAD', desc: 'Upload project documents' },
  { code: 'DOCUMENT_APPROVE', desc: 'Approve project documents' },
  { code: 'USER_MANAGE', desc: 'Manage users' },
  { code: 'ROLE_MANAGE', desc: 'Manage roles' },
  { code: 'AUDIT_VIEW', desc: 'View audit logs' },
  { code: 'ANALYTICS_VIEW', desc: 'View analytics' },
]

export async function seedRolesAndPermissions() {
  try {
    logger.info('[Seed] Verifying Roles and Permissions...')

    // 1. Seed Roles
    for (const r of DEFAULT_ROLES) {
      const existing = await queryOne('SELECT RoleId FROM Roles WHERE RoleName = @name', [{ name: 'name', value: r.name }])
      if (!existing) {
        await execute('INSERT INTO Roles (RoleName, Description) VALUES (@name, @desc)', [
          { name: 'name', value: r.name },
          { name: 'desc', value: r.desc },
        ])
      }
    }

    // 2. Seed Permissions
    for (const p of DEFAULT_PERMISSIONS) {
      const existing = await queryOne('SELECT PermissionId FROM Permissions WHERE PermissionCode = @code', [{ name: 'code', value: p.code }])
      if (!existing) {
        await execute('INSERT INTO Permissions (PermissionCode, Description) VALUES (@code, @desc)', [
          { name: 'code', value: p.code },
          { name: 'desc', value: p.desc },
        ])
      }
    }

    // 3. Seed Role Permissions
    // Super Administrator gets all permissions
    const superAdminRole = await queryOne<{ RoleId: number }>('SELECT RoleId FROM Roles WHERE RoleName = N\'Super Administrator\'')
    if (superAdminRole) {
      const allPerms = await query<{ PermissionId: number }>('SELECT PermissionId FROM Permissions')
      for (const perm of allPerms) {
        const hasPerm = await queryOne(
          'SELECT 1 FROM RolePermissions WHERE RoleId = @rId AND PermissionId = @pId',
          [
            { name: 'rId', value: superAdminRole.RoleId },
            { name: 'pId', value: perm.PermissionId },
          ]
        )
        if (!hasPerm) {
          await execute('INSERT INTO RolePermissions (RoleId, PermissionId) VALUES (@rId, @pId)', [
            { name: 'rId', value: superAdminRole.RoleId },
            { name: 'pId', value: perm.PermissionId },
          ])
        }
      }
    }

    logger.info('[Seed] Roles and permissions verified successfully.')
  } catch (err: any) {
    logger.error('[Seed Error] Failed to seed roles and permissions:', err)
  }
}

export async function seedDemoUsers() {
  try {
    logger.info('[Seed] Checking and seeding default KeNHA user accounts into SQL Server...')

    await seedRolesAndPermissions()

    for (const u of DEFAULT_USERS) {
      const existing = await queryOne<{ UserId: number }>(
        'SELECT UserId FROM Users WHERE Email = @email',
        [{ name: 'email', value: u.email }]
      )

      const salt = await bcrypt.genSalt(10)
      const passwordHash = await bcrypt.hash(u.password, salt)

      let userId: number

      if (existing) {
        userId = existing.UserId
        // Update password hash and name to ensure they match credentials
        await execute(
          'UPDATE Users SET FullName = @fullName, PasswordHash = @passwordHash, IsActive = 1, UpdatedAt = SYSUTCDATETIME() WHERE UserId = @userId',
          [
            { name: 'userId', value: userId },
            { name: 'fullName', value: u.fullName },
            { name: 'passwordHash', value: passwordHash },
          ]
        )
      } else {
        const insertRes = await execute(
          `INSERT INTO Users (FullName, Email, PasswordHash, IsActive)
           OUTPUT INSERTED.UserId
           VALUES (@fullName, @email, @passwordHash, 1)`,
          [
            { name: 'fullName', value: u.fullName },
            { name: 'email', value: u.email },
            { name: 'passwordHash', value: passwordHash },
          ]
        )
        userId = insertRes.recordset?.[0]?.UserId
      }

      if (userId) {
        // Link roles
        for (const roleName of u.roles) {
          const role = await queryOne<{ RoleId: number }>(
            'SELECT RoleId FROM Roles WHERE RoleName = @roleName',
            [{ name: 'roleName', value: roleName }]
          )

          if (role) {
            const hasRole = await queryOne(
              'SELECT 1 FROM UserRoles WHERE UserId = @userId AND RoleId = @roleId',
              [
                { name: 'userId', value: userId },
                { name: 'roleId', value: role.RoleId },
              ]
            )

            if (!hasRole) {
              await execute(
                'INSERT INTO UserRoles (UserId, RoleId) VALUES (@userId, @roleId)',
                [
                  { name: 'userId', value: userId },
                  { name: 'roleId', value: role.RoleId },
                ]
              )
            }
          }
        }
      }
    }

    logger.info('[Seed] Successfully verified and seeded all KeNHA admin and user accounts.')
  } catch (err: any) {
    logger.error('[Seed Error] Failed to seed user accounts:', err)
  }
}

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
