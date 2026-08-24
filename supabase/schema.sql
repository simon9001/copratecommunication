-- =====================================================================
--  KeNHA VR Projects — PostgreSQL / Supabase schema
--  Paste this whole file into the Supabase SQL Editor and run it once.
--
--  IDENTIFIER CASING
--  -----------------
--  PostgreSQL folds unquoted identifiers to lower case. Every table and
--  column below is quoted in "PascalCase" so that rows come back to the
--  Node API as { ProjectId, ProjectName, ... } exactly as the previous
--  SQL Server schema did. Every query in the backend quotes them too.
--  If you write your own SQL against this database, you must quote
--  identifiers as well: SELECT "ProjectName" FROM "Projects";
--
--  ROW LEVEL SECURITY
--  ------------------
--  The API talks to this database over a direct Postgres connection as
--  the table owner, which bypasses RLS. RLS is switched on with no
--  policies so that the anon and authenticated PostgREST roles cannot
--  reach these tables directly. All public reads go through the Node
--  API's /api/v1/public/* routes.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Clean slate (safe to re-run)
-- ---------------------------------------------------------------------

DROP VIEW  IF EXISTS "vw_ProjectSummary"    CASCADE;
DROP VIEW  IF EXISTS "vw_PublicProjectMap"  CASCADE;

DROP TABLE IF EXISTS "AuditLogs"           CASCADE;
DROP TABLE IF EXISTS "ProjectWorkflow"     CASCADE;
DROP TABLE IF EXISTS "VRHotspots"          CASCADE;
DROP TABLE IF EXISTS "VRProjectSettings"   CASCADE;
DROP TABLE IF EXISTS "ProjectRoutes"       CASCADE;
DROP TABLE IF EXISTS "ProjectDocuments"    CASCADE;
DROP TABLE IF EXISTS "ProjectUpdates"      CASCADE;
DROP TABLE IF EXISTS "ProjectMilestones"   CASCADE;
DROP TABLE IF EXISTS "ProjectStatistics"   CASCADE;
DROP TABLE IF EXISTS "ProjectMedia"        CASCADE;
DROP TABLE IF EXISTS "ProjectOrganizations" CASCADE;
DROP TABLE IF EXISTS "Organizations"       CASCADE;
DROP TABLE IF EXISTS "ProjectCategoryMap"  CASCADE;
DROP TABLE IF EXISTS "ProjectCategories"   CASCADE;
DROP TABLE IF EXISTS "ProjectLocations"    CASCADE;
DROP TABLE IF EXISTS "Projects"            CASCADE;
DROP TABLE IF EXISTS "RolePermissions"     CASCADE;
DROP TABLE IF EXISTS "Permissions"         CASCADE;
DROP TABLE IF EXISTS "UserRoles"           CASCADE;
DROP TABLE IF EXISTS "Users"               CASCADE;
DROP TABLE IF EXISTS "Roles"               CASCADE;

DROP FUNCTION IF EXISTS set_updated_at() CASCADE;

-- ---------------------------------------------------------------------
-- 1. Shared trigger: keep "UpdatedAt" honest
-- ---------------------------------------------------------------------

CREATE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."UpdatedAt" = NOW();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- 2. IDENTITY: one Editor role, one account
--
--    VISITOR — anonymous, no account, reads the published globe.
--    EDITOR  — the single login, creates and publishes all content.
--
--    There is no approval chain, because there is nobody to approve to.
-- ---------------------------------------------------------------------

CREATE TABLE "Roles" (
  "RoleId"      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "RoleName"    TEXT NOT NULL UNIQUE,
  "Description" TEXT,
  "CreatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "Users" (
  "UserId"       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "FullName"     TEXT NOT NULL,
  "Email"        TEXT NOT NULL UNIQUE,
  "PasswordHash" TEXT NOT NULL,
  "IsActive"     BOOLEAN NOT NULL DEFAULT TRUE,
  "LastLoginAt"  TIMESTAMPTZ,
  "CreatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "UpdatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER "trg_Users_UpdatedAt"
  BEFORE UPDATE ON "Users"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE "UserRoles" (
  "UserId" INT NOT NULL REFERENCES "Users"("UserId") ON DELETE CASCADE,
  "RoleId" INT NOT NULL REFERENCES "Roles"("RoleId") ON DELETE CASCADE,
  PRIMARY KEY ("UserId", "RoleId")
);

CREATE TABLE "Permissions" (
  "PermissionId"   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "PermissionCode" TEXT NOT NULL UNIQUE,
  "Description"    TEXT
);

CREATE TABLE "RolePermissions" (
  "RoleId"       INT NOT NULL REFERENCES "Roles"("RoleId") ON DELETE CASCADE,
  "PermissionId" INT NOT NULL REFERENCES "Permissions"("PermissionId") ON DELETE CASCADE,
  PRIMARY KEY ("RoleId", "PermissionId")
);

-- ---------------------------------------------------------------------
-- 3. PROJECTS
-- ---------------------------------------------------------------------

CREATE TABLE "Projects" (
  "ProjectId"              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "ProjectCode"            TEXT NOT NULL UNIQUE,
  "ProjectName"            TEXT NOT NULL,
  "Slug"                   TEXT NOT NULL UNIQUE,

  "ShortDescription"       TEXT,
  "FullDescription"        TEXT,

  "ProjectStatus"          TEXT NOT NULL DEFAULT 'Planned',
  "PublicationStatus"      TEXT NOT NULL DEFAULT 'Draft',

  "StartDate"              DATE,
  "ExpectedCompletionDate" DATE,
  "CompletionDate"         DATE,

  "ProjectCost"            NUMERIC(18,2),
  "CurrencyCode"           CHAR(3) NOT NULL DEFAULT 'KES',
  "LengthKm"               NUMERIC(12,2),

  "IsFeatured"             BOOLEAN NOT NULL DEFAULT FALSE,
  "IsPublished"            BOOLEAN NOT NULL DEFAULT FALSE,

  "CreatedBy"              INT REFERENCES "Users"("UserId") ON DELETE SET NULL,
  "UpdatedBy"              INT REFERENCES "Users"("UserId") ON DELETE SET NULL,
  "ApprovedBy"             INT REFERENCES "Users"("UserId") ON DELETE SET NULL,
  "ApprovedAt"             TIMESTAMPTZ,
  "PublishedAt"            TIMESTAMPTZ,

  "CreatedAt"              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "UpdatedAt"              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "CK_Projects_Status" CHECK (
    "ProjectStatus" IN ('Planned', 'Ongoing', 'Completed', 'Suspended', 'Cancelled')
  ),
  CONSTRAINT "CK_Projects_PublicationStatus" CHECK (
    "PublicationStatus" IN ('Draft', 'Pending Review', 'Changes Requested', 'Approved', 'Published', 'Archived')
  )
);

CREATE TRIGGER "trg_Projects_UpdatedAt"
  BEFORE UPDATE ON "Projects"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 4. PROJECT LOCATIONS
--    Latitude/Longitude are plain numerics. See the optional PostGIS
--    block at the bottom if you later want real spatial queries.
-- ---------------------------------------------------------------------

CREATE TABLE "ProjectLocations" (
  "LocationId"        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "ProjectId"         INT NOT NULL REFERENCES "Projects"("ProjectId") ON DELETE CASCADE,

  "LocationName"      TEXT,
  "County"            TEXT NOT NULL,
  "SubCounty"         TEXT,
  "Ward"              TEXT,
  "Address"           TEXT,

  "Latitude"          NUMERIC(10,7) NOT NULL,
  "Longitude"         NUMERIC(10,7) NOT NULL,

  "IsPrimaryLocation" BOOLEAN NOT NULL DEFAULT TRUE,
  "CreatedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "CK_ProjectLocations_Latitude"  CHECK ("Latitude"  BETWEEN -90  AND 90),
  CONSTRAINT "CK_ProjectLocations_Longitude" CHECK ("Longitude" BETWEEN -180 AND 180)
);

-- ---------------------------------------------------------------------
-- 5. CATEGORIES
-- ---------------------------------------------------------------------

CREATE TABLE "ProjectCategories" (
  "CategoryId"   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "CategoryName" TEXT NOT NULL UNIQUE,
  "Description"  TEXT,
  "IconName"     TEXT,
  "IsActive"     BOOLEAN NOT NULL DEFAULT TRUE,
  "CreatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "ProjectCategoryMap" (
  "ProjectId"  INT NOT NULL REFERENCES "Projects"("ProjectId") ON DELETE CASCADE,
  "CategoryId" INT NOT NULL REFERENCES "ProjectCategories"("CategoryId") ON DELETE CASCADE,
  PRIMARY KEY ("ProjectId", "CategoryId")
);

-- ---------------------------------------------------------------------
-- 6. ORGANISATIONS
-- ---------------------------------------------------------------------

CREATE TABLE "Organizations" (
  "OrganizationId"   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "OrganizationName" TEXT NOT NULL,
  "ShortName"        TEXT,
  "OrganizationType" TEXT,
  "Description"      TEXT,
  "Website"          TEXT,
  "LogoUrl"          TEXT,
  "CreatedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "ProjectOrganizations" (
  "ProjectId"        INT NOT NULL REFERENCES "Projects"("ProjectId") ON DELETE CASCADE,
  "OrganizationId"   INT NOT NULL REFERENCES "Organizations"("OrganizationId") ON DELETE CASCADE,
  "RelationshipType" TEXT NOT NULL,
  PRIMARY KEY ("ProjectId", "OrganizationId", "RelationshipType")
);

-- ---------------------------------------------------------------------
-- 7. MEDIA
--    MediaUrl is TEXT so it can hold either a Cloudinary URL or a
--    base64 data URI pasted straight from the editor's browser.
-- ---------------------------------------------------------------------

CREATE TABLE "ProjectMedia" (
  "MediaId"         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "ProjectId"       INT NOT NULL REFERENCES "Projects"("ProjectId") ON DELETE CASCADE,

  "MediaType"       TEXT NOT NULL,
  "Title"           TEXT,
  "Description"     TEXT,

  "MediaUrl"        TEXT NOT NULL,
  "ThumbnailUrl"    TEXT,

  "DurationSeconds" INT,
  "FileSizeBytes"   BIGINT,
  "MimeType"        TEXT,

  "ApprovalStatus"  TEXT NOT NULL DEFAULT 'Draft',

  "DisplayOrder"    INT NOT NULL DEFAULT 0,
  "IsFeatured"      BOOLEAN NOT NULL DEFAULT FALSE,
  "IsPublished"     BOOLEAN NOT NULL DEFAULT FALSE,

  "UploadedBy"      INT REFERENCES "Users"("UserId") ON DELETE SET NULL,
  "ApprovedBy"      INT REFERENCES "Users"("UserId") ON DELETE SET NULL,
  "ApprovedAt"      TIMESTAMPTZ,

  "CreatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "CK_ProjectMedia_Type" CHECK (
    "MediaType" IN ('VIDEO', 'IMAGE', '360_VIDEO', '360_IMAGE', 'MODEL_3D')
  ),
  CONSTRAINT "CK_ProjectMedia_ApprovalStatus" CHECK (
    "ApprovalStatus" IN ('Draft', 'Pending Review', 'Approved', 'Rejected', 'Published', 'Archived')
  )
);

-- ---------------------------------------------------------------------
-- 8. STATISTICS / MILESTONES / UPDATES / DOCUMENTS
-- ---------------------------------------------------------------------

CREATE TABLE "ProjectStatistics" (
  "StatisticId"  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "ProjectId"    INT NOT NULL REFERENCES "Projects"("ProjectId") ON DELETE CASCADE,
  "MetricName"   TEXT NOT NULL,
  "MetricValue"  TEXT NOT NULL,
  "Unit"         TEXT,
  "Description"  TEXT,
  "DisplayOrder" INT NOT NULL DEFAULT 0,
  "CreatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "ProjectMilestones" (
  "MilestoneId"          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "ProjectId"            INT NOT NULL REFERENCES "Projects"("ProjectId") ON DELETE CASCADE,
  "Title"                TEXT NOT NULL,
  "Description"          TEXT,
  "MilestoneDate"        DATE,
  "CompletionPercentage" NUMERIC(5,2),
  "Status"               TEXT NOT NULL DEFAULT 'Completed',
  "CreatedAt"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "CK_ProjectMilestones_Percentage" CHECK (
    "CompletionPercentage" IS NULL OR "CompletionPercentage" BETWEEN 0 AND 100
  )
);

CREATE TABLE "ProjectUpdates" (
  "UpdateId"           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "ProjectId"          INT NOT NULL REFERENCES "Projects"("ProjectId") ON DELETE CASCADE,

  "Title"              TEXT NOT NULL,
  "Content"            TEXT NOT NULL,

  "ProgressPercentage" NUMERIC(5,2),
  "UpdateDate"         DATE NOT NULL,

  "PublicationStatus"  TEXT NOT NULL DEFAULT 'Draft',

  "CreatedBy"          INT REFERENCES "Users"("UserId") ON DELETE SET NULL,
  "ApprovedBy"         INT REFERENCES "Users"("UserId") ON DELETE SET NULL,
  "ApprovedAt"         TIMESTAMPTZ,
  "PublishedAt"        TIMESTAMPTZ,

  "CreatedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "UpdatedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "CK_ProjectUpdates_Progress" CHECK (
    "ProgressPercentage" IS NULL OR "ProgressPercentage" BETWEEN 0 AND 100
  ),
  CONSTRAINT "CK_ProjectUpdates_PublicationStatus" CHECK (
    "PublicationStatus" IN ('Draft', 'Pending Review', 'Changes Requested', 'Approved', 'Published', 'Archived')
  )
);

CREATE TRIGGER "trg_ProjectUpdates_UpdatedAt"
  BEFORE UPDATE ON "ProjectUpdates"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE "ProjectDocuments" (
  "DocumentId"     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "ProjectId"      INT NOT NULL REFERENCES "Projects"("ProjectId") ON DELETE CASCADE,

  "DocumentTitle"  TEXT NOT NULL,
  "DocumentType"   TEXT,
  "FileUrl"        TEXT NOT NULL,
  "FileSizeBytes"  BIGINT,
  "MimeType"       TEXT,
  "Version"        TEXT,

  "ApprovalStatus" TEXT NOT NULL DEFAULT 'Draft',

  "UploadedBy"     INT REFERENCES "Users"("UserId") ON DELETE SET NULL,
  "ApprovedBy"     INT REFERENCES "Users"("UserId") ON DELETE SET NULL,
  "ApprovedAt"     TIMESTAMPTZ,

  "UploadedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "CK_ProjectDocuments_ApprovalStatus" CHECK (
    "ApprovalStatus" IN ('Draft', 'Pending Review', 'Approved', 'Rejected', 'Published', 'Archived')
  )
);

-- ---------------------------------------------------------------------
-- 9. ROUTES (road geometry served to the globe as GeoJSON)
-- ---------------------------------------------------------------------

CREATE TABLE "ProjectRoutes" (
  "RouteId"      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "ProjectId"    INT NOT NULL REFERENCES "Projects"("ProjectId") ON DELETE CASCADE,

  "RouteName"    TEXT,
  "GeometryType" TEXT NOT NULL DEFAULT 'LineString',
  "GeoJson"      TEXT,

  "CreatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "CK_ProjectRoutes_GeometryType" CHECK (
    "GeometryType" IN ('LineString', 'MultiLineString')
  )
);

-- ---------------------------------------------------------------------
-- 10. VR PRESENTATION
-- ---------------------------------------------------------------------

CREATE TABLE "VRProjectSettings" (
  "VRProjectSettingId"    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "ProjectId"             INT NOT NULL UNIQUE REFERENCES "Projects"("ProjectId") ON DELETE CASCADE,

  "MarkerColor"           TEXT NOT NULL DEFAULT '#39FF88',
  "MarkerSize"            NUMERIC(8,2) NOT NULL DEFAULT 1.0,

  "FlyToAltitude"         NUMERIC(12,2),
  "FlyToDurationSeconds"  NUMERIC(8,2) NOT NULL DEFAULT 2.5,

  "PanelPosition"         TEXT NOT NULL DEFAULT 'Floating',
  "AutoPlayFeaturedVideo" BOOLEAN NOT NULL DEFAULT FALSE,

  "EnableVR"              BOOLEAN NOT NULL DEFAULT TRUE,
  "EnableFullscreenVideo" BOOLEAN NOT NULL DEFAULT TRUE,

  "CreatedAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "UpdatedAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER "trg_VRProjectSettings_UpdatedAt"
  BEFORE UPDATE ON "VRProjectSettings"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE "VRHotspots" (
  "HotspotId"     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "ProjectId"     INT NOT NULL REFERENCES "Projects"("ProjectId") ON DELETE CASCADE,

  "Title"         TEXT NOT NULL,
  "Description"   TEXT,

  "PositionX"     NUMERIC(18,8),
  "PositionY"     NUMERIC(18,8),
  "PositionZ"     NUMERIC(18,8),

  "ActionType"    TEXT NOT NULL DEFAULT 'INFO',
  "TargetMediaId" INT REFERENCES "ProjectMedia"("MediaId") ON DELETE SET NULL,

  "IsActive"      BOOLEAN NOT NULL DEFAULT TRUE,
  "CreatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "CK_VRHotspots_ActionType" CHECK (
    "ActionType" IN ('INFO', 'VIDEO', 'IMAGE', 'LINK', 'FULLSCREEN_MEDIA')
  )
);

-- ---------------------------------------------------------------------
-- 11. WORKFLOW HISTORY & AUDIT
-- ---------------------------------------------------------------------

CREATE TABLE "ProjectWorkflow" (
  "WorkflowId"  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "ProjectId"   INT NOT NULL REFERENCES "Projects"("ProjectId") ON DELETE CASCADE,

  "Action"      TEXT NOT NULL,
  "FromStatus"  TEXT,
  "ToStatus"    TEXT,
  "Comment"     TEXT,

  "PerformedBy" INT REFERENCES "Users"("UserId") ON DELETE SET NULL,
  "PerformedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "AuditLogs" (
  "AuditLogId" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "UserId"     INT REFERENCES "Users"("UserId") ON DELETE SET NULL,

  "Action"     TEXT NOT NULL,
  "EntityName" TEXT,
  "EntityId"   TEXT,

  "OldValues"  TEXT,
  "NewValues"  TEXT,

  "IpAddress"  TEXT,
  "UserAgent"  TEXT,

  "CreatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 12. INDEXES
-- ---------------------------------------------------------------------

CREATE INDEX "IX_ProjectLocations_ProjectId" ON "ProjectLocations"("ProjectId");
CREATE INDEX "IX_ProjectLocations_County"    ON "ProjectLocations"("County");
CREATE INDEX "IX_ProjectMedia_ProjectId"     ON "ProjectMedia"("ProjectId");
CREATE INDEX "IX_ProjectMedia_Type"          ON "ProjectMedia"("MediaType");
CREATE INDEX "IX_ProjectMilestones_ProjectId" ON "ProjectMilestones"("ProjectId");
CREATE INDEX "IX_ProjectUpdates_ProjectId"   ON "ProjectUpdates"("ProjectId");
CREATE INDEX "IX_ProjectStatistics_ProjectId" ON "ProjectStatistics"("ProjectId");
CREATE INDEX "IX_ProjectRoutes_ProjectId"    ON "ProjectRoutes"("ProjectId");
CREATE INDEX "IX_ProjectWorkflow_ProjectId"  ON "ProjectWorkflow"("ProjectId");
CREATE INDEX "IX_ProjectWorkflow_PerformedAt" ON "ProjectWorkflow"("PerformedAt" DESC);
CREATE INDEX "IX_AuditLogs_UserId"           ON "AuditLogs"("UserId");
CREATE INDEX "IX_AuditLogs_CreatedAt"        ON "AuditLogs"("CreatedAt");
CREATE INDEX "IX_Projects_Published"         ON "Projects"("IsPublished");
CREATE INDEX "IX_Projects_Status"            ON "Projects"("ProjectStatus");

-- ---------------------------------------------------------------------
-- 13. SEED: the single Editor role
-- ---------------------------------------------------------------------

INSERT INTO "Roles" ("RoleName", "Description") VALUES
  ('Editor', 'The sole content account: creates, edits, and publishes all highway project content');

-- Review/approval codes are omitted (nothing to review against), as are
-- USER_MANAGE and ROLE_MANAGE (no other accounts exist).
INSERT INTO "Permissions" ("PermissionCode", "Description") VALUES
  ('PROJECT_CREATE',     'Create projects'),
  ('PROJECT_VIEW',       'View projects'),
  ('PROJECT_EDIT',       'Edit projects'),
  ('PROJECT_DELETE',     'Delete projects'),
  ('PROJECT_PUBLISH',    'Publish projects to the public globe'),
  ('PROJECT_UNPUBLISH',  'Withdraw projects from the public globe'),
  ('MEDIA_UPLOAD',       'Upload project media'),
  ('MEDIA_EDIT',         'Edit project media'),
  ('MEDIA_DELETE',       'Delete project media'),
  ('UPDATE_CREATE',      'Create project updates'),
  ('UPDATE_EDIT',        'Edit project updates'),
  ('UPDATE_PUBLISH',     'Publish project updates'),
  ('DOCUMENT_UPLOAD',    'Upload project documents'),
  ('CATEGORY_MANAGE',    'Manage infrastructure categories'),
  ('ANALYTICS_VIEW',     'View dashboard analytics');

-- The Editor holds every permission.
INSERT INTO "RolePermissions" ("RoleId", "PermissionId")
SELECT r."RoleId", p."PermissionId"
FROM "Roles" r
CROSS JOIN "Permissions" p
WHERE r."RoleName" = 'Editor';

-- ---------------------------------------------------------------------
-- 14. SEED: categories
--
--     The Editor account itself is NOT seeded here — the API creates it
--     on first boot with a freshly bcrypt-hashed password, so the hash
--     never has to live in a checked-in SQL file.
-- ---------------------------------------------------------------------

INSERT INTO "ProjectCategories" ("CategoryName", "Description", "IconName") VALUES
  ('Roads',               'Highway and road infrastructure projects',       'road'),
  ('Expressways',         'Expressway infrastructure projects',             'expressway'),
  ('Bridges',             'Bridge construction and rehabilitation projects','bridge'),
  ('Bypasses',            'Road bypass projects',                           'route'),
  ('Interchanges',        'Highway interchange projects',                   'interchange'),
  ('Road Rehabilitation', 'Road improvement and rehabilitation projects',   'construction');

-- ---------------------------------------------------------------------
-- 15. VIEWS
-- ---------------------------------------------------------------------

CREATE VIEW "vw_PublicProjectMap" AS
SELECT
  p."ProjectId",
  p."ProjectCode",
  p."ProjectName",
  p."Slug",
  p."ShortDescription",
  p."ProjectStatus",
  p."IsFeatured",
  pl."LocationId",
  pl."LocationName",
  pl."County",
  pl."SubCounty",
  pl."Ward",
  pl."Latitude",
  pl."Longitude"
FROM "Projects" p
JOIN "ProjectLocations" pl ON p."ProjectId" = pl."ProjectId"
WHERE p."IsPublished" = TRUE
  AND p."PublicationStatus" = 'Published'
  AND pl."IsPrimaryLocation" = TRUE;

CREATE VIEW "vw_ProjectSummary" AS
SELECT
  p."ProjectId",
  p."ProjectCode",
  p."ProjectName",
  p."Slug",
  p."ShortDescription",
  p."ProjectStatus",
  p."PublicationStatus",
  p."StartDate",
  p."ExpectedCompletionDate",
  p."CompletionDate",
  p."ProjectCost",
  p."CurrencyCode",
  p."LengthKm",
  p."IsFeatured",
  p."IsPublished",
  pl."County",
  pl."SubCounty",
  pl."Ward",
  pl."Latitude",
  pl."Longitude"
FROM "Projects" p
LEFT JOIN "ProjectLocations" pl
  ON p."ProjectId" = pl."ProjectId" AND pl."IsPrimaryLocation" = TRUE;

-- ---------------------------------------------------------------------
-- 16. ROW LEVEL SECURITY
--
--     Enabled with no policies: the anon and authenticated PostgREST
--     roles get nothing. The Node API connects as the table owner and
--     bypasses RLS, and serves public data through its own routes.
-- ---------------------------------------------------------------------

ALTER TABLE "Roles"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Users"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserRoles"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Permissions"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RolePermissions"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Projects"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectLocations"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectCategories"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectCategoryMap"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Organizations"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectOrganizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectMedia"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectStatistics"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectMilestones"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectUpdates"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectDocuments"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectRoutes"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VRProjectSettings"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VRHotspots"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectWorkflow"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLogs"            ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ---------------------------------------------------------------------
-- 17. Verify
-- ---------------------------------------------------------------------

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;


-- =====================================================================
--  OPTIONAL: PostGIS spatial upgrade
--  ---------------------------------------------------------------
--  Nothing in the current API queries geometry — the globe is driven by
--  Latitude/Longitude and the "GeoJson" text column. Run this block only
--  if you later want radius searches, nearest-project lookups, or
--  spatial joins.
--
--  CREATE EXTENSION IF NOT EXISTS postgis;
--
--  ALTER TABLE "ProjectLocations"
--    ADD COLUMN "LocationPoint" geography(Point, 4326)
--    GENERATED ALWAYS AS (
--      ST_SetSRID(ST_MakePoint("Longitude"::float8, "Latitude"::float8), 4326)::geography
--    ) STORED;
--
--  CREATE INDEX "SIX_ProjectLocations_LocationPoint"
--    ON "ProjectLocations" USING GIST ("LocationPoint");
--
--  ALTER TABLE "ProjectRoutes"
--    ADD COLUMN "RouteGeometry" geography(Geometry, 4326);
--
--  CREATE INDEX "SIX_ProjectRoutes_RouteGeometry"
--    ON "ProjectRoutes" USING GIST ("RouteGeometry");
-- =====================================================================
