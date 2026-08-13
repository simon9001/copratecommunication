IF DB_ID(N'KeNHA_VR_Projects') IS NULL
BEGIN
    CREATE DATABASE KeNHA_VR_Projects;
END
GO

USE KeNHA_VR_Projects;
GO

/* =========================================================
   1. USERS / ROLES / PERMISSIONS
   ========================================================= */

CREATE TABLE Roles (
    RoleId INT IDENTITY(1,1) PRIMARY KEY,
    RoleName NVARCHAR(100) NOT NULL UNIQUE,
    Description NVARCHAR(500) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE Users (
    UserId INT IDENTITY(1,1) PRIMARY KEY,
    FullName NVARCHAR(200) NOT NULL,
    Email NVARCHAR(320) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(500) NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    LastLoginAt DATETIME2 NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE UserRoles (
    UserId INT NOT NULL,
    RoleId INT NOT NULL,
    PRIMARY KEY (UserId, RoleId),
    CONSTRAINT FK_UserRoles_User
        FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE,
    CONSTRAINT FK_UserRoles_Role
        FOREIGN KEY (RoleId) REFERENCES Roles(RoleId) ON DELETE CASCADE
);
GO

CREATE TABLE Permissions (
    PermissionId INT IDENTITY(1,1) PRIMARY KEY,
    PermissionCode NVARCHAR(100) NOT NULL UNIQUE,
    Description NVARCHAR(500) NULL
);
GO

CREATE TABLE RolePermissions (
    RoleId INT NOT NULL,
    PermissionId INT NOT NULL,
    PRIMARY KEY (RoleId, PermissionId),
    CONSTRAINT FK_RolePermissions_Role
        FOREIGN KEY (RoleId) REFERENCES Roles(RoleId) ON DELETE CASCADE,
    CONSTRAINT FK_RolePermissions_Permission
        FOREIGN KEY (PermissionId) REFERENCES Permissions(PermissionId) ON DELETE CASCADE
);
GO

/* =========================================================
   2. PROJECTS
   ========================================================= */

CREATE TABLE Projects (
    ProjectId INT IDENTITY(1,1) PRIMARY KEY,
    ProjectCode NVARCHAR(50) NOT NULL UNIQUE,
    ProjectName NVARCHAR(250) NOT NULL,
    Slug NVARCHAR(250) NOT NULL UNIQUE,

    ShortDescription NVARCHAR(1000) NULL,
    FullDescription NVARCHAR(MAX) NULL,

    ProjectStatus NVARCHAR(50) NOT NULL DEFAULT N'Draft',
    PublicationStatus NVARCHAR(50) NOT NULL DEFAULT N'Draft',

    StartDate DATE NULL,
    ExpectedCompletionDate DATE NULL,
    CompletionDate DATE NULL,

    ProjectCost DECIMAL(18,2) NULL,
    CurrencyCode CHAR(3) NOT NULL DEFAULT 'KES',
    LengthKm DECIMAL(12,2) NULL,

    IsFeatured BIT NOT NULL DEFAULT 0,
    IsPublished BIT NOT NULL DEFAULT 0,

    CreatedBy INT NULL,
    UpdatedBy INT NULL,
    ApprovedBy INT NULL,
    ApprovedAt DATETIME2 NULL,
    PublishedAt DATETIME2 NULL,

    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT CK_Projects_Status CHECK (
        ProjectStatus IN (
            N'Planned', N'Ongoing', N'Completed',
            N'Suspended', N'Cancelled'
        )
    ),

    CONSTRAINT CK_Projects_PublicationStatus CHECK (
        PublicationStatus IN (
            N'Draft', N'Pending Review', N'Changes Requested',
            N'Approved', N'Published', N'Archived'
        )
    ),

    CONSTRAINT FK_Projects_CreatedBy
        FOREIGN KEY (CreatedBy) REFERENCES Users(UserId),

    CONSTRAINT FK_Projects_UpdatedBy
        FOREIGN KEY (UpdatedBy) REFERENCES Users(UserId),

    CONSTRAINT FK_Projects_ApprovedBy
        FOREIGN KEY (ApprovedBy) REFERENCES Users(UserId)
);
GO

/* =========================================================
   3. PROJECT LOCATIONS
   ========================================================= */

CREATE TABLE ProjectLocations (
    LocationId INT IDENTITY(1,1) PRIMARY KEY,
    ProjectId INT NOT NULL,

    LocationName NVARCHAR(250) NULL,
    County NVARCHAR(100) NOT NULL,
    SubCounty NVARCHAR(100) NULL,
    Ward NVARCHAR(100) NULL,
    Address NVARCHAR(500) NULL,

    Latitude DECIMAL(10,7) NOT NULL,
    Longitude DECIMAL(10,7) NOT NULL,

    LocationPoint GEOGRAPHY NULL,

    IsPrimaryLocation BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT FK_ProjectLocations_Project
        FOREIGN KEY (ProjectId)
        REFERENCES Projects(ProjectId)
        ON DELETE CASCADE,

    CONSTRAINT CK_ProjectLocations_Latitude
        CHECK (Latitude BETWEEN -90 AND 90),

    CONSTRAINT CK_ProjectLocations_Longitude
        CHECK (Longitude BETWEEN -180 AND 180)
);
GO

CREATE TRIGGER TR_ProjectLocations_CreateGeography
ON ProjectLocations
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE PL
    SET LocationPoint = geography::Point(
        PL.Latitude,
        PL.Longitude,
        4326
    )
    FROM ProjectLocations PL
    INNER JOIN inserted I
        ON PL.LocationId = I.LocationId;
END;
GO

/* =========================================================
   4. PROJECT CATEGORIES
   ========================================================= */

CREATE TABLE ProjectCategories (
    CategoryId INT IDENTITY(1,1) PRIMARY KEY,
    CategoryName NVARCHAR(150) NOT NULL UNIQUE,
    Description NVARCHAR(500) NULL,
    IconName NVARCHAR(100) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE ProjectCategoryMap (
    ProjectId INT NOT NULL,
    CategoryId INT NOT NULL,
    PRIMARY KEY (ProjectId, CategoryId),

    CONSTRAINT FK_ProjectCategoryMap_Project
        FOREIGN KEY (ProjectId)
        REFERENCES Projects(ProjectId)
        ON DELETE CASCADE,

    CONSTRAINT FK_ProjectCategoryMap_Category
        FOREIGN KEY (CategoryId)
        REFERENCES ProjectCategories(CategoryId)
        ON DELETE CASCADE
);
GO

/* =========================================================
   5. ORGANIZATIONS / CONTRACTORS / PARTNERS
   ========================================================= */

CREATE TABLE Organizations (
    OrganizationId INT IDENTITY(1,1) PRIMARY KEY,
    OrganizationName NVARCHAR(250) NOT NULL,
    ShortName NVARCHAR(100) NULL,
    OrganizationType NVARCHAR(100) NULL,
    Description NVARCHAR(1000) NULL,
    Website NVARCHAR(500) NULL,
    LogoUrl NVARCHAR(2000) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE ProjectOrganizations (
    ProjectId INT NOT NULL,
    OrganizationId INT NOT NULL,
    RelationshipType NVARCHAR(100) NOT NULL,

    PRIMARY KEY (ProjectId, OrganizationId, RelationshipType),

    CONSTRAINT FK_ProjectOrganizations_Project
        FOREIGN KEY (ProjectId)
        REFERENCES Projects(ProjectId)
        ON DELETE CASCADE,

    CONSTRAINT FK_ProjectOrganizations_Organization
        FOREIGN KEY (OrganizationId)
        REFERENCES Organizations(OrganizationId)
        ON DELETE CASCADE
);
GO

/* =========================================================
   6. PROJECT MEDIA
   ========================================================= */

CREATE TABLE ProjectMedia (
    MediaId INT IDENTITY(1,1) PRIMARY KEY,
    ProjectId INT NOT NULL,

    MediaType NVARCHAR(30) NOT NULL,
    Title NVARCHAR(250) NULL,
    Description NVARCHAR(1000) NULL,

    MediaUrl NVARCHAR(2000) NOT NULL,
    ThumbnailUrl NVARCHAR(2000) NULL,

    DurationSeconds INT NULL,
    FileSizeBytes BIGINT NULL,
    MimeType NVARCHAR(100) NULL,

    ApprovalStatus NVARCHAR(50) NOT NULL DEFAULT N'Draft',

    DisplayOrder INT NOT NULL DEFAULT 0,
    IsFeatured BIT NOT NULL DEFAULT 0,
    IsPublished BIT NOT NULL DEFAULT 0,

    UploadedBy INT NULL,
    ApprovedBy INT NULL,
    ApprovedAt DATETIME2 NULL,

    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT FK_ProjectMedia_Project
        FOREIGN KEY (ProjectId)
        REFERENCES Projects(ProjectId)
        ON DELETE CASCADE,

    CONSTRAINT FK_ProjectMedia_UploadedBy
        FOREIGN KEY (UploadedBy) REFERENCES Users(UserId),

    CONSTRAINT FK_ProjectMedia_ApprovedBy
        FOREIGN KEY (ApprovedBy) REFERENCES Users(UserId),

    CONSTRAINT CK_ProjectMedia_Type CHECK (
        MediaType IN (
            N'VIDEO', N'IMAGE', N'360_VIDEO',
            N'360_IMAGE', N'MODEL_3D'
        )
    ),

    CONSTRAINT CK_ProjectMedia_ApprovalStatus CHECK (
        ApprovalStatus IN (
            N'Draft', N'Pending Review', N'Approved',
            N'Rejected', N'Published', N'Archived'
        )
    )
);
GO

/* =========================================================
   7. PROJECT STATISTICS
   ========================================================= */

CREATE TABLE ProjectStatistics (
    StatisticId INT IDENTITY(1,1) PRIMARY KEY,
    ProjectId INT NOT NULL,

    MetricName NVARCHAR(150) NOT NULL,
    MetricValue NVARCHAR(100) NOT NULL,
    Unit NVARCHAR(50) NULL,
    Description NVARCHAR(500) NULL,

    DisplayOrder INT NOT NULL DEFAULT 0,

    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT FK_ProjectStatistics_Project
        FOREIGN KEY (ProjectId)
        REFERENCES Projects(ProjectId)
        ON DELETE CASCADE
);
GO

/* =========================================================
   8. PROJECT MILESTONES / TIMELINE
   ========================================================= */

CREATE TABLE ProjectMilestones (
    MilestoneId INT IDENTITY(1,1) PRIMARY KEY,
    ProjectId INT NOT NULL,

    Title NVARCHAR(250) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    MilestoneDate DATE NULL,

    CompletionPercentage DECIMAL(5,2) NULL,
    Status NVARCHAR(50) NOT NULL DEFAULT N'Completed',

    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT FK_ProjectMilestones_Project
        FOREIGN KEY (ProjectId)
        REFERENCES Projects(ProjectId)
        ON DELETE CASCADE,

    CONSTRAINT CK_ProjectMilestones_Percentage CHECK (
        CompletionPercentage IS NULL
        OR CompletionPercentage BETWEEN 0 AND 100
    )
);
GO

/* =========================================================
   9. PROJECT UPDATES / CORPORATE COMMUNICATIONS NEWS
   ========================================================= */

CREATE TABLE ProjectUpdates (
    UpdateId INT IDENTITY(1,1) PRIMARY KEY,
    ProjectId INT NOT NULL,

    Title NVARCHAR(250) NOT NULL,
    Content NVARCHAR(MAX) NOT NULL,

    ProgressPercentage DECIMAL(5,2) NULL,
    UpdateDate DATE NOT NULL,

    PublicationStatus NVARCHAR(50) NOT NULL DEFAULT N'Draft',

    CreatedBy INT NULL,
    ApprovedBy INT NULL,
    ApprovedAt DATETIME2 NULL,
    PublishedAt DATETIME2 NULL,

    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT FK_ProjectUpdates_Project
        FOREIGN KEY (ProjectId)
        REFERENCES Projects(ProjectId)
        ON DELETE CASCADE,

    CONSTRAINT FK_ProjectUpdates_CreatedBy
        FOREIGN KEY (CreatedBy) REFERENCES Users(UserId),

    CONSTRAINT FK_ProjectUpdates_ApprovedBy
        FOREIGN KEY (ApprovedBy) REFERENCES Users(UserId),

    CONSTRAINT CK_ProjectUpdates_Progress CHECK (
        ProgressPercentage IS NULL
        OR ProgressPercentage BETWEEN 0 AND 100
    ),

    CONSTRAINT CK_ProjectUpdates_PublicationStatus CHECK (
        PublicationStatus IN (
            N'Draft', N'Pending Review', N'Changes Requested',
            N'Approved', N'Published', N'Archived'
        )
    )
);
GO

/* =========================================================
   10. PROJECT DOCUMENTS
   ========================================================= */

CREATE TABLE ProjectDocuments (
    DocumentId INT IDENTITY(1,1) PRIMARY KEY,
    ProjectId INT NOT NULL,

    DocumentTitle NVARCHAR(250) NOT NULL,
    DocumentType NVARCHAR(100) NULL,
    FileUrl NVARCHAR(2000) NOT NULL,
    FileSizeBytes BIGINT NULL,
    MimeType NVARCHAR(100) NULL,
    Version NVARCHAR(50) NULL,

    ApprovalStatus NVARCHAR(50) NOT NULL DEFAULT N'Draft',

    UploadedBy INT NULL,
    ApprovedBy INT NULL,
    ApprovedAt DATETIME2 NULL,

    UploadedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT FK_ProjectDocuments_Project
        FOREIGN KEY (ProjectId)
        REFERENCES Projects(ProjectId)
        ON DELETE CASCADE,

    CONSTRAINT FK_ProjectDocuments_UploadedBy
        FOREIGN KEY (UploadedBy) REFERENCES Users(UserId),

    CONSTRAINT FK_ProjectDocuments_ApprovedBy
        FOREIGN KEY (ApprovedBy) REFERENCES Users(UserId),

    CONSTRAINT CK_ProjectDocuments_ApprovalStatus CHECK (
        ApprovalStatus IN (
            N'Draft', N'Pending Review', N'Approved',
            N'Rejected', N'Published', N'Archived'
        )
    )
);
GO

/* =========================================================
   11. PROJECT ROUTES / ROAD GEOMETRY
   ========================================================= */

CREATE TABLE ProjectRoutes (
    RouteId INT IDENTITY(1,1) PRIMARY KEY,
    ProjectId INT NOT NULL,

    RouteName NVARCHAR(250) NULL,
    GeometryType NVARCHAR(30) NOT NULL DEFAULT N'LineString',

    RouteGeometry GEOGRAPHY NULL,

    GeoJson NVARCHAR(MAX) NULL,

    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT FK_ProjectRoutes_Project
        FOREIGN KEY (ProjectId)
        REFERENCES Projects(ProjectId)
        ON DELETE CASCADE,

    CONSTRAINT CK_ProjectRoutes_GeometryType CHECK (
        GeometryType IN (N'LineString', N'MultiLineString')
    )
);
GO

/* =========================================================
   12. VR / 3D PRESENTATION
   ========================================================= */

CREATE TABLE VRProjectSettings (
    VRProjectSettingId INT IDENTITY(1,1) PRIMARY KEY,
    ProjectId INT NOT NULL UNIQUE,

    MarkerColor NVARCHAR(20) NOT NULL DEFAULT N'#39FF88',
    MarkerSize DECIMAL(8,2) NOT NULL DEFAULT 1.0,

    FlyToAltitude DECIMAL(12,2) NULL,
    FlyToDurationSeconds DECIMAL(8,2) NOT NULL DEFAULT 2.5,

    PanelPosition NVARCHAR(50) NOT NULL DEFAULT N'Floating',
    AutoPlayFeaturedVideo BIT NOT NULL DEFAULT 0,

    EnableVR BIT NOT NULL DEFAULT 1,
    EnableFullscreenVideo BIT NOT NULL DEFAULT 1,

    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT FK_VRProjectSettings_Project
        FOREIGN KEY (ProjectId)
        REFERENCES Projects(ProjectId)
        ON DELETE CASCADE
);
GO

/* =========================================================
   13. VR HOTSPOTS
   ========================================================= */

CREATE TABLE VRHotspots (
    HotspotId INT IDENTITY(1,1) PRIMARY KEY,
    ProjectId INT NOT NULL,

    Title NVARCHAR(250) NOT NULL,
    Description NVARCHAR(1000) NULL,

    PositionX DECIMAL(18,8) NULL,
    PositionY DECIMAL(18,8) NULL,
    PositionZ DECIMAL(18,8) NULL,

    ActionType NVARCHAR(50) NOT NULL DEFAULT N'INFO',
    TargetMediaId INT NULL,

    IsActive BIT NOT NULL DEFAULT 1,

    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT FK_VRHotspots_Project
        FOREIGN KEY (ProjectId)
        REFERENCES Projects(ProjectId)
        ON DELETE CASCADE,

    CONSTRAINT FK_VRHotspots_Media
        FOREIGN KEY (TargetMediaId)
        REFERENCES ProjectMedia(MediaId),

    CONSTRAINT CK_VRHotspots_ActionType CHECK (
        ActionType IN (
            N'INFO', N'VIDEO', N'IMAGE',
            N'LINK', N'FULLSCREEN_MEDIA'
        )
    )
);
GO

/* =========================================================
   14. WORKFLOW / APPROVAL HISTORY
   ========================================================= */

CREATE TABLE ProjectWorkflow (
    WorkflowId BIGINT IDENTITY(1,1) PRIMARY KEY,

    ProjectId INT NOT NULL,

    Action NVARCHAR(100) NOT NULL,

    FromStatus NVARCHAR(50) NULL,
    ToStatus NVARCHAR(50) NULL,

    Comment NVARCHAR(2000) NULL,

    PerformedBy INT NULL,
    PerformedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT FK_ProjectWorkflow_Project
        FOREIGN KEY (ProjectId)
        REFERENCES Projects(ProjectId)
        ON DELETE CASCADE,

    CONSTRAINT FK_ProjectWorkflow_User
        FOREIGN KEY (PerformedBy)
        REFERENCES Users(UserId)
);
GO

/* =========================================================
   15. AUDIT LOG
   ========================================================= */

CREATE TABLE AuditLogs (
    AuditLogId BIGINT IDENTITY(1,1) PRIMARY KEY,

    UserId INT NULL,

    Action NVARCHAR(100) NOT NULL,
    EntityName NVARCHAR(100) NULL,
    EntityId NVARCHAR(100) NULL,

    OldValues NVARCHAR(MAX) NULL,
    NewValues NVARCHAR(MAX) NULL,

    IpAddress NVARCHAR(100) NULL,
    UserAgent NVARCHAR(1000) NULL,

    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT FK_AuditLogs_User
        FOREIGN KEY (UserId)
        REFERENCES Users(UserId)
);
GO

/* =========================================================
   16. INDEXES
   ========================================================= */

CREATE INDEX IX_ProjectLocations_ProjectId
ON ProjectLocations(ProjectId);
GO

CREATE INDEX IX_ProjectLocations_County
ON ProjectLocations(County);
GO

CREATE SPATIAL INDEX SIX_ProjectLocations_LocationPoint
ON ProjectLocations(LocationPoint);
GO

CREATE INDEX IX_ProjectMedia_ProjectId
ON ProjectMedia(ProjectId);
GO

CREATE INDEX IX_ProjectMedia_Type
ON ProjectMedia(MediaType);
GO

CREATE INDEX IX_ProjectMilestones_ProjectId
ON ProjectMilestones(ProjectId);
GO

CREATE INDEX IX_ProjectUpdates_ProjectId
ON ProjectUpdates(ProjectId);
GO

CREATE INDEX IX_ProjectStatistics_ProjectId
ON ProjectStatistics(ProjectId);
GO

CREATE INDEX IX_ProjectWorkflow_ProjectId
ON ProjectWorkflow(ProjectId);
GO

CREATE INDEX IX_AuditLogs_UserId
ON AuditLogs(UserId);
GO

CREATE INDEX IX_AuditLogs_CreatedAt
ON AuditLogs(CreatedAt);
GO

/* =========================================================
   17. SEED ROLES
   ========================================================= */

INSERT INTO Roles (RoleName, Description)
VALUES
(N'Super Administrator', N'Full system and configuration access'),
(N'Communications Officer', N'Create and manage project content and submit it for review'),
(N'Communications Editor', N'Review project content and request changes'),
(N'Communications Manager', N'Approve and publish official project content'),
(N'ICT Administrator', N'Manage users, roles, configuration, integrations and system health'),
(N'Viewer', N'Read-only access to the internal portal');
GO

/* =========================================================
   18. SEED PERMISSIONS
   ========================================================= */

INSERT INTO Permissions (PermissionCode, Description)
VALUES
(N'PROJECT_CREATE', N'Create projects'),
(N'PROJECT_VIEW', N'View projects'),
(N'PROJECT_EDIT', N'Edit projects'),
(N'PROJECT_DELETE', N'Delete projects'),
(N'PROJECT_SUBMIT_REVIEW', N'Submit projects for review'),
(N'PROJECT_REVIEW', N'Review projects'),
(N'PROJECT_APPROVE', N'Approve projects'),
(N'PROJECT_PUBLISH', N'Publish projects'),
(N'PROJECT_UNPUBLISH', N'Unpublish projects'),
(N'MEDIA_UPLOAD', N'Upload project media'),
(N'MEDIA_EDIT', N'Edit project media'),
(N'MEDIA_APPROVE', N'Approve project media'),
(N'MEDIA_DELETE', N'Delete project media'),
(N'UPDATE_CREATE', N'Create project updates'),
(N'UPDATE_EDIT', N'Edit project updates'),
(N'UPDATE_APPROVE', N'Approve project updates'),
(N'UPDATE_PUBLISH', N'Publish project updates'),
(N'DOCUMENT_UPLOAD', N'Upload project documents'),
(N'DOCUMENT_APPROVE', N'Approve project documents'),
(N'USER_MANAGE', N'Manage users'),
(N'ROLE_MANAGE', N'Manage roles'),
(N'AUDIT_VIEW', N'View audit logs'),
(N'ANALYTICS_VIEW', N'View analytics');
GO

/* =========================================================
   19. DEFAULT ROLE PERMISSIONS
   ========================================================= */

DECLARE @RoleId INT;

-- Communications Officer
SELECT @RoleId = RoleId FROM Roles WHERE RoleName = N'Communications Officer';

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT @RoleId, PermissionId
FROM Permissions
WHERE PermissionCode IN (
    N'PROJECT_CREATE',
    N'PROJECT_VIEW',
    N'PROJECT_EDIT',
    N'PROJECT_SUBMIT_REVIEW',
    N'MEDIA_UPLOAD',
    N'MEDIA_EDIT',
    N'UPDATE_CREATE',
    N'UPDATE_EDIT',
    N'DOCUMENT_UPLOAD'
);

-- Communications Editor
SELECT @RoleId = RoleId FROM Roles WHERE RoleName = N'Communications Editor';

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT @RoleId, PermissionId
FROM Permissions
WHERE PermissionCode IN (
    N'PROJECT_VIEW',
    N'PROJECT_EDIT',
    N'PROJECT_REVIEW',
    N'MEDIA_EDIT',
    N'MEDIA_APPROVE',
    N'UPDATE_EDIT',
    N'UPDATE_APPROVE',
    N'DOCUMENT_APPROVE'
);

-- Communications Manager
SELECT @RoleId = RoleId FROM Roles WHERE RoleName = N'Communications Manager';

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT @RoleId, PermissionId
FROM Permissions
WHERE PermissionCode IN (
    N'PROJECT_VIEW',
    N'PROJECT_EDIT',
    N'PROJECT_REVIEW',
    N'PROJECT_APPROVE',
    N'PROJECT_PUBLISH',
    N'PROJECT_UNPUBLISH',
    N'MEDIA_UPLOAD',
    N'MEDIA_EDIT',
    N'MEDIA_APPROVE',
    N'UPDATE_CREATE',
    N'UPDATE_EDIT',
    N'UPDATE_APPROVE',
    N'UPDATE_PUBLISH',
    N'DOCUMENT_UPLOAD',
    N'DOCUMENT_APPROVE',
    N'ANALYTICS_VIEW'
);

-- ICT Administrator
SELECT @RoleId = RoleId FROM Roles WHERE RoleName = N'ICT Administrator';

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT @RoleId, PermissionId
FROM Permissions
WHERE PermissionCode IN (
    N'PROJECT_VIEW',
    N'USER_MANAGE',
    N'ROLE_MANAGE',
    N'AUDIT_VIEW',
    N'ANALYTICS_VIEW'
);

-- Super Administrator gets everything
SELECT @RoleId = RoleId FROM Roles WHERE RoleName = N'Super Administrator';

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT @RoleId, PermissionId
FROM Permissions;
GO

/* =========================================================
   20. PROJECT CATEGORIES
   ========================================================= */

INSERT INTO ProjectCategories
(CategoryName, Description, IconName)
VALUES
(N'Roads', N'Highway and road infrastructure projects', N'road'),
(N'Expressways', N'Expressway infrastructure projects', N'expressway'),
(N'Bridges', N'Bridge construction and rehabilitation projects', N'bridge'),
(N'Bypasses', N'Road bypass projects', N'route'),
(N'Interchanges', N'Highway interchange projects', N'interchange'),
(N'Road Rehabilitation', N'Road improvement and rehabilitation projects', N'construction');
GO

/* =========================================================
   21. VIEWS
   ========================================================= */

CREATE VIEW vw_PublicProjectMap
AS
SELECT
    p.ProjectId,
    p.ProjectCode,
    p.ProjectName,
    p.Slug,
    p.ShortDescription,
    p.ProjectStatus,
    p.IsFeatured,

    pl.LocationId,
    pl.LocationName,
    pl.County,
    pl.SubCounty,
    pl.Ward,
    pl.Latitude,
    pl.Longitude,
    pl.LocationPoint
FROM Projects p
INNER JOIN ProjectLocations pl
    ON p.ProjectId = pl.ProjectId
WHERE
    p.IsPublished = 1
    AND p.PublicationStatus = N'Published'
    AND pl.IsPrimaryLocation = 1;
GO

CREATE VIEW vw_ProjectSummary
AS
SELECT
    p.ProjectId,
    p.ProjectCode,
    p.ProjectName,
    p.Slug,
    p.ShortDescription,
    p.ProjectStatus,
    p.PublicationStatus,
    p.StartDate,
    p.ExpectedCompletionDate,
    p.CompletionDate,
    p.ProjectCost,
    p.CurrencyCode,
    p.LengthKm,
    p.IsFeatured,
    p.IsPublished,

    pl.County,
    pl.SubCounty,
    pl.Ward,
    pl.Latitude,
    pl.Longitude
FROM Projects p
LEFT JOIN ProjectLocations pl
    ON p.ProjectId = pl.ProjectId
    AND pl.IsPrimaryLocation = 1;
GO
