import { UserService } from './user.service.js';
import { createSuccessResponse } from '../../errors/errorResponse.js';
export class UserController {
    static async listUsers(c) {
        const users = await UserService.listUsers();
        return c.json(createSuccessResponse(users, 'Users list retrieved', undefined, c.get('requestId')));
    }
    static async createUser(c) {
        const body = c.get('validatedBody');
        const result = await UserService.createUser(body);
        return c.json(createSuccessResponse(result, 'User account created successfully', undefined, c.get('requestId')), 201);
    }
    static async toggleStatus(c) {
        const paramId = c.req.param('id') || '';
        const userId = parseInt(paramId, 10);
        const body = await c.req.json().catch(() => ({}));
        const isActive = Boolean(body.isActive);
        await UserService.toggleUserStatus(userId, isActive);
        return c.json(createSuccessResponse(null, `User status updated to ${isActive ? 'active' : 'inactive'}`, undefined, c.get('requestId')));
    }
    static async deleteUser(c) {
        const paramId = c.req.param('id') || '';
        const userId = parseInt(paramId, 10);
        await UserService.deleteUser(userId);
        return c.json(createSuccessResponse(null, 'User account deleted successfully', undefined, c.get('requestId')));
    }
}
