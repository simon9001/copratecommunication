import { z } from 'zod';
export const registerUserSchema = z.object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
    email: z.string().email('Invalid email address format'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    roleNames: z.array(z.string()).optional().default(['Viewer']),
});
export const loginUserSchema = z.object({
    email: z.string().email('Invalid email address format'),
    password: z.string().min(1, 'Password is required'),
});
