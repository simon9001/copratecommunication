import { execute } from '../../db/query.js';
import { logger } from '../../services/logger.service.js';
export class AuditRepository {
    static async log(userId, action, entityName = null, entityId = null, oldValues = null, newValues = null, ipAddress = null, userAgent = null) {
        try {
            const oldValStr = oldValues ? JSON.stringify(oldValues) : null;
            const newValStr = newValues ? JSON.stringify(newValues) : null;
            await execute(`INSERT INTO AuditLogs (UserId, Action, EntityName, EntityId, OldValues, NewValues, IpAddress, UserAgent)
         VALUES (@userId, @action, @entityName, @entityId, @oldValues, @newValues, @ipAddress, @userAgent)`, [
                { name: 'userId', value: userId },
                { name: 'action', value: action },
                { name: 'entityName', value: entityName },
                { name: 'entityId', value: entityId },
                { name: 'oldValues', value: oldValStr },
                { name: 'newValues', value: newValStr },
                { name: 'ipAddress', value: ipAddress },
                { name: 'userAgent', value: userAgent },
            ]);
        }
        catch (err) {
            logger.error('[Audit Log Error] Failed to write audit record:', err);
        }
    }
    static async logWorkflow(projectId, action, fromStatus, toStatus, comment, performedBy) {
        try {
            await execute(`INSERT INTO ProjectWorkflow (ProjectId, Action, FromStatus, ToStatus, Comment, PerformedBy)
         VALUES (@projectId, @action, @fromStatus, @toStatus, @comment, @performedBy)`, [
                { name: 'projectId', value: projectId },
                { name: 'action', value: action },
                { name: 'fromStatus', value: fromStatus },
                { name: 'toStatus', value: toStatus },
                { name: 'comment', value: comment },
                { name: 'performedBy', value: performedBy },
            ]);
        }
        catch (err) {
            logger.error('[Workflow Log Error] Failed to write project workflow record:', err);
        }
    }
}
