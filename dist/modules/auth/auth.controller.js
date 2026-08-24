import { AuthService } from './auth.service.js';
import { createSuccessResponse } from '../../errors/errorResponse.js';
export class AuthController {
    static async login(c) {
        const body = c.get('validatedBody');
        const result = await AuthService.login(body);
        return c.json(createSuccessResponse(result, 'Authentication successful', undefined, c.get('requestId')));
    }
    static async me(c) {
        const userPayload = c.get('user');
        const profile = await AuthService.getProfile(userPayload.userId);
        return c.json(createSuccessResponse(profile, 'Current user profile retrieved', undefined, c.get('requestId')));
    }
}
