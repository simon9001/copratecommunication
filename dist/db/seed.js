import { execute, query, queryOne } from './query.js';
import { logger } from '../services/logger.service.js';
import bcrypt from 'bcryptjs';
/**
 * ============================================================
 * SINGLE-ACCOUNT IDENTITY MODEL
 * ============================================================
 * This system has exactly two audiences:
 *
 *   1. VISITOR  - anonymous, no account. Reads the published
 *                 globe/map through the /api/v1/public routes.
 *   2. EDITOR   - the one and only login. Creates and publishes
 *                 every piece of content in the system.
 *
 * There is no approval chain, because there is nobody to approve
 * to. The Editor writes and the Editor publishes.
 *
 * The tables themselves are created by supabase/schema.sql. This
 * module only guarantees the Editor account exists with a freshly
 * hashed password, and that nothing else does.
 */
export const EDITOR_ROLE = 'Editor';
export const DEFAULT_ROLES = [
    { name: EDITOR_ROLE, desc: 'The sole content account: creates, edits, and publishes all highway project content' },
];
/**
 * Every permission the Editor holds. Review/approval codes are gone
 * (nothing to review against) and so are USER_MANAGE / ROLE_MANAGE
 * (there are no other accounts to manage).
 */
export const DEFAULT_PERMISSIONS = [
    { code: 'PROJECT_CREATE', desc: 'Create projects' },
    { code: 'PROJECT_VIEW', desc: 'View projects' },
    { code: 'PROJECT_EDIT', desc: 'Edit projects' },
    { code: 'PROJECT_DELETE', desc: 'Delete projects' },
    { code: 'PROJECT_PUBLISH', desc: 'Publish projects to the public globe' },
    { code: 'PROJECT_UNPUBLISH', desc: 'Withdraw projects from the public globe' },
    { code: 'MEDIA_UPLOAD', desc: 'Upload project media' },
    { code: 'MEDIA_EDIT', desc: 'Edit project media' },
    { code: 'MEDIA_DELETE', desc: 'Delete project media' },
    { code: 'UPDATE_CREATE', desc: 'Create project updates' },
    { code: 'UPDATE_EDIT', desc: 'Edit project updates' },
    { code: 'UPDATE_PUBLISH', desc: 'Publish project updates' },
    { code: 'DOCUMENT_UPLOAD', desc: 'Upload project documents' },
    { code: 'CATEGORY_MANAGE', desc: 'Manage infrastructure categories' },
    { code: 'ANALYTICS_VIEW', desc: 'View dashboard analytics' },
];
/** The single account. */
export const EDITOR_ACCOUNT = {
    fullName: 'KeNHA Content Editor',
    email: 'editor@kenha.co.ke',
    password: 'Editor@KeNHA2026!',
    roles: [EDITOR_ROLE],
    description: 'Adds highway projects, photos, videos and updates, and publishes them to the public globe.',
};
/** Roles seeded by earlier versions of this system that must not survive. */
const RETIRED_ROLES = [
    'Super Administrator',
    'ICT Administrator',
    'Communications Manager',
    'Communications Editor',
    'Communications Officer',
    'Viewer',
];
/**
 * Confirms the schema has actually been applied. Without this the first
 * failure would be a confusing "relation does not exist" from whichever
 * insert happened to run first.
 */
export async function assertSchemaPresent() {
    const row = await queryOne(`SELECT to_regclass('public."Projects"') IS NOT NULL AS present`);
    if (!row?.present) {
        logger.error('[Schema Missing] The "Projects" table was not found. ' +
            'Run supabase/schema.sql in the Supabase SQL Editor before starting the API.');
        return false;
    }
    return true;
}
export async function seedRolesAndPermissions() {
    try {
        logger.info('[Seed] Verifying Editor role and permissions...');
        // 1. Seed the Editor role
        for (const r of DEFAULT_ROLES) {
            await execute(`INSERT INTO "Roles" ("RoleName", "Description")
         VALUES (@name, @desc)
         ON CONFLICT ("RoleName") DO NOTHING`, [
                { name: 'name', value: r.name },
                { name: 'desc', value: r.desc },
            ]);
        }
        // 2. Seed permissions
        for (const p of DEFAULT_PERMISSIONS) {
            await execute(`INSERT INTO "Permissions" ("PermissionCode", "Description")
         VALUES (@code, @desc)
         ON CONFLICT ("PermissionCode") DO NOTHING`, [
                { name: 'code', value: p.code },
                { name: 'desc', value: p.desc },
            ]);
        }
        // 3. The Editor role holds every permission in DEFAULT_PERMISSIONS
        await execute(`INSERT INTO "RolePermissions" ("RoleId", "PermissionId")
       SELECT r."RoleId", p."PermissionId"
       FROM "Roles" r
       CROSS JOIN "Permissions" p
       WHERE r."RoleName" = @roleName
       ON CONFLICT DO NOTHING`, [{ name: 'roleName', value: EDITOR_ROLE }]);
        logger.info('[Seed] Editor role and permissions verified successfully.');
    }
    catch (err) {
        logger.error('[Seed Error] Failed to seed role and permissions:', err);
    }
}
/**
 * Removes every account and role left over from the old multi-role
 * system, so that exactly one login remains.
 *
 * Content authored by a retired account is reassigned to the Editor
 * rather than deleted. The Users foreign keys are ON DELETE SET NULL, so
 * deleting outright would silently strip the authorship from every
 * project, media item and workflow entry those accounts created.
 */
export async function pruneLegacyAccounts(editorUserId) {
    try {
        const stale = await query('SELECT "UserId", "Email" FROM "Users" WHERE "UserId" <> @editorUserId', [{ name: 'editorUserId', value: editorUserId }]);
        if (stale.length === 0) {
            logger.info('[Seed] Single-account model verified: only the Editor account exists.');
        }
        else {
            logger.warn(`[Seed] Removing ${stale.length} legacy account(s) and reassigning their content to the Editor...`);
            // Reassign authorship on every table that points at Users.
            const reassignments = [
                ['Projects', ['CreatedBy', 'UpdatedBy', 'ApprovedBy']],
                ['ProjectMedia', ['UploadedBy', 'ApprovedBy']],
                ['ProjectUpdates', ['CreatedBy', 'ApprovedBy']],
                ['ProjectDocuments', ['UploadedBy', 'ApprovedBy']],
                ['ProjectWorkflow', ['PerformedBy']],
                ['AuditLogs', ['UserId']],
            ];
            for (const [table, columns] of reassignments) {
                for (const column of columns) {
                    // Table and column names here are literals from the list above,
                    // never user input.
                    await execute(`UPDATE "${table}"
             SET "${column}" = @editorUserId
             WHERE "${column}" IS NOT NULL AND "${column}" <> @editorUserId`, [{ name: 'editorUserId', value: editorUserId }]);
                }
            }
            // UserRoles cascades from Users, so deleting the user is enough.
            await execute('DELETE FROM "Users" WHERE "UserId" <> @editorUserId', [
                { name: 'editorUserId', value: editorUserId },
            ]);
            for (const u of stale) {
                logger.info(`[Seed] Removed legacy account '${u.Email}'.`);
            }
        }
        // Drop the retired roles themselves (RolePermissions cascades).
        for (const roleName of RETIRED_ROLES) {
            const res = await execute('DELETE FROM "Roles" WHERE "RoleName" = @name', [
                { name: 'name', value: roleName },
            ]);
            if ((res.rowsAffected[0] ?? 0) > 0) {
                logger.info(`[Seed] Removed retired role '${roleName}'.`);
            }
        }
    }
    catch (err) {
        logger.error('[Seed Error] Failed to prune legacy accounts:', err);
    }
}
/**
 * Ensures the Editor account exists with the expected credentials,
 * then strips out everything else.
 */
export async function seedEditorAccount() {
    try {
        if (!(await assertSchemaPresent()))
            return;
        logger.info('[Seed] Verifying the KeNHA Editor account...');
        await seedRolesAndPermissions();
        const u = EDITOR_ACCOUNT;
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(u.password, salt);
        const upserted = await execute(`INSERT INTO "Users" ("FullName", "Email", "PasswordHash", "IsActive")
       VALUES (@fullName, @email, @passwordHash, TRUE)
       ON CONFLICT ("Email") DO UPDATE
         SET "FullName"     = EXCLUDED."FullName",
             "PasswordHash" = EXCLUDED."PasswordHash",
             "IsActive"     = TRUE
       RETURNING "UserId"`, [
            { name: 'fullName', value: u.fullName },
            { name: 'email', value: u.email },
            { name: 'passwordHash', value: passwordHash },
        ]);
        const userId = upserted.recordset?.[0]?.UserId;
        if (!userId) {
            logger.error('[Seed Error] Could not resolve the Editor account id; skipping cleanup.');
            return;
        }
        // Bind the Editor role (and only that role) to the account.
        const role = await queryOne('SELECT "RoleId" FROM "Roles" WHERE "RoleName" = @roleName', [
            { name: 'roleName', value: EDITOR_ROLE },
        ]);
        if (role) {
            await execute('DELETE FROM "UserRoles" WHERE "UserId" = @userId AND "RoleId" <> @roleId', [
                { name: 'userId', value: userId },
                { name: 'roleId', value: role.RoleId },
            ]);
            await execute(`INSERT INTO "UserRoles" ("UserId", "RoleId")
         VALUES (@userId, @roleId)
         ON CONFLICT DO NOTHING`, [
                { name: 'userId', value: userId },
                { name: 'roleId', value: role.RoleId },
            ]);
        }
        await pruneLegacyAccounts(userId);
        logger.info(`[Seed] Editor account ready: ${u.email}`);
    }
    catch (err) {
        logger.error('[Seed Error] Failed to seed the Editor account:', err);
    }
}
export async function seedDemoProjects() {
    try {
        if (!(await assertSchemaPresent()))
            return;
        logger.info('[Seed] Checking and seeding sample KeNHA highway projects...');
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
        ];
        for (const p of projectsData) {
            const existing = await queryOne('SELECT "ProjectId" FROM "Projects" WHERE "ProjectCode" = @code OR "Slug" = @slug', [
                { name: 'code', value: p.code },
                { name: 'slug', value: p.slug },
            ]);
            if (existing) {
                // Ensure published status
                await execute(`UPDATE "Projects"
           SET "PublicationStatus" = 'Published', "IsPublished" = TRUE
           WHERE "ProjectId" = @id`, [{ name: 'id', value: existing.ProjectId }]);
                // Ensure a primary location exists
                const locExisting = await queryOne('SELECT "LocationId" FROM "ProjectLocations" WHERE "ProjectId" = @projectId', [{ name: 'projectId', value: existing.ProjectId }]);
                if (!locExisting) {
                    await execute(`INSERT INTO "ProjectLocations" (
              "ProjectId", "LocationName", "County", "SubCounty", "Latitude", "Longitude", "IsPrimaryLocation"
            ) VALUES (
              @projectId, @name, @county, @subCounty, @lat, @lng, TRUE
            )`, [
                        { name: 'projectId', value: existing.ProjectId },
                        { name: 'name', value: p.name },
                        { name: 'county', value: p.county },
                        { name: 'subCounty', value: p.subCounty },
                        { name: 'lat', value: p.lat },
                        { name: 'lng', value: p.lng },
                    ]);
                }
                continue;
            }
            const projRes = await execute(`INSERT INTO "Projects" (
          "ProjectCode", "ProjectName", "Slug", "ShortDescription", "FullDescription",
          "ProjectStatus", "PublicationStatus", "ProjectCost", "CurrencyCode", "LengthKm",
          "IsFeatured", "IsPublished"
        )
        VALUES (
          @code, @name, @slug, @shortDesc, @fullDesc,
          @status, @pubStatus, @cost, 'KES', @length,
          @isFeatured, @isPublished
        )
        RETURNING "ProjectId"`, [
                { name: 'code', value: p.code },
                { name: 'name', value: p.name },
                { name: 'slug', value: p.slug },
                { name: 'shortDesc', value: p.shortDesc },
                { name: 'fullDesc', value: p.fullDesc },
                { name: 'status', value: p.status },
                { name: 'pubStatus', value: p.publicationStatus },
                { name: 'cost', value: p.cost },
                { name: 'length', value: p.lengthKm },
                { name: 'isFeatured', value: Boolean(p.isFeatured) },
                { name: 'isPublished', value: Boolean(p.isPublished) },
            ]);
            const projectId = projRes.recordset?.[0]?.ProjectId;
            if (projectId) {
                await execute(`INSERT INTO "ProjectLocations" (
            "ProjectId", "LocationName", "County", "SubCounty", "Latitude", "Longitude", "IsPrimaryLocation"
          )
          VALUES (
            @projectId, @locName, @county, @subCounty, @lat, @lng, TRUE
          )`, [
                    { name: 'projectId', value: projectId },
                    { name: 'locName', value: p.name },
                    { name: 'county', value: p.county },
                    { name: 'subCounty', value: p.subCounty },
                    { name: 'lat', value: p.lat },
                    { name: 'lng', value: p.lng },
                ]);
                await execute(`INSERT INTO "VRProjectSettings" ("ProjectId")
           VALUES (@projectId)
           ON CONFLICT ("ProjectId") DO NOTHING`, [{ name: 'projectId', value: projectId }]);
            }
        }
        logger.info('[Seed] Successfully verified and seeded KeNHA highway projects with GPS coordinates.');
    }
    catch (err) {
        logger.error('[Seed Error] Failed to seed demo projects:', err);
    }
}
