import { execute } from '../../db/query.js'
import { logger } from '../../services/logger.service.js'

export class AuditRepository {
  public static async log(
    userId: number | null,
    action: string,
    entityName: string | null = null,
    entityId: string | null = null,
    oldValues: unknown = null,
    newValues: unknown = null,
    ipAddress: string | null = null,
    userAgent: string | null = null
  ): Promise<void> {
    try {
      const oldValStr = oldValues ? JSON.stringify(oldValues) : null
      const newValStr = newValues ? JSON.stringify(newValues) : null

      await execute(
        `INSERT INTO AuditLogs (UserId, Action, EntityName, EntityId, OldValues, NewValues, IpAddress, UserAgent)
         VALUES (@userId, @action, @entityName, @entityId, @oldValues, @newValues, @ipAddress, @userAgent)`,
        [
          { name: 'userId', value: userId },
          { name: 'action', value: action },
          { name: 'entityName', value: entityName },
          { name: 'entityId', value: entityId },
          { name: 'oldValues', value: oldValStr },
          { name: 'newValues', value: newValStr },
          { name: 'ipAddress', value: ipAddress },
          { name: 'userAgent', value: userAgent },
        ]
      )
    } catch (err) {
      logger.error('[Audit Log Error] Failed to write audit record:', err)
    }
  }

  public static async logWorkflow(
    projectId: number,
    action: string,
    fromStatus: string | null,
    toStatus: string | null,
    comment: string | null,
    performedBy: number | null
  ): Promise<void> {
    try {
      await execute(
        `INSERT INTO ProjectWorkflow (ProjectId, Action, FromStatus, ToStatus, Comment, PerformedBy)
         VALUES (@projectId, @action, @fromStatus, @toStatus, @comment, @performedBy)`,
        [
          { name: 'projectId', value: projectId },
          { name: 'action', value: action },
          { name: 'fromStatus', value: fromStatus },
          { name: 'toStatus', value: toStatus },
          { name: 'comment', value: comment },
          { name: 'performedBy', value: performedBy },
        ]
      )
    } catch (err) {
      logger.error('[Workflow Log Error] Failed to write project workflow record:', err)
    }
  }
}
