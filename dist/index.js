import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { env } from './config/env.js';
import { requestIdMiddleware } from './middleware/requestId.middleware.js';
import { loggerMiddleware } from './middleware/logger.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import { notFoundHandler } from './middleware/notFound.middleware.js';
import { apiV1Router } from './routes/index.js';
import { closeDbPool, checkDbHealth, warnIfRlsBlocksAccess } from './db/connection.js';
import { CloudinaryService } from './services/cloudinary.service.js';
import { HealthController } from './modules/health/health.controller.js';
import { logger } from './services/logger.service.js';
import { seedDemoProjects, seedEditorAccount } from './db/seed.js';
import { validateSupabaseConfigAtStartup, checkSupabaseHealth } from './services/supabase.service.js';
const app = new Hono();
// Enable CORS for frontend integration
app.use('*', cors({
    origin: ['http://localhost:5173', 'https://copratecommunicatrion.netlify.app'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    credentials: true,
}));
// Global Middlewares
app.use('*', requestIdMiddleware);
app.use('*', loggerMiddleware);
// Top-Level Prometheus Metrics Route
app.get('/metrics', HealthController.getMetrics);
// Mount API v1 Routes
app.route('/api/v1', apiV1Router);
// Root Welcome Route
app.get('/', (c) => {
    return c.json({
        system: 'KeNHA VR Projects Backend API',
        version: '1.0.0',
        status: 'ONLINE',
        endpoints: {
            health: '/api/v1/health',
            metrics: '/metrics',
            apiV1: '/api/v1',
        },
        timestamp: new Date().toISOString(),
    });
});
// Error & Not Found Handlers
app.onError(errorHandler);
app.notFound(notFoundHandler);
// Startup Health Diagnostics & Server Launch
serve({
    fetch: app.fetch,
    port: env.PORT,
}, async (info) => {
    logger.info(`🚀 KeNHA VR Projects API running on http://localhost:${info.port}`);
    logger.info(`👉 Health Check Endpoint: http://localhost:${info.port}/api/v1/health`);
    logger.info(`📊 Prometheus Metrics: http://localhost:${info.port}/metrics`);
    // Startup Diagnostics Probe
    const dbStatus = await checkDbHealth();
    const cloudinaryStatus = await CloudinaryService.checkCloudinaryHealth();
    if (dbStatus.status === 'healthy') {
        logger.info(`✅ [Database] Postgres connected successfully (${dbStatus.latencyMs}ms)`);
        // RLS hides rows silently rather than erroring, so confirm this
        // connection can actually see them before trusting anything below.
        await warnIfRlsBlocksAccess();
        // Seed the single Editor account and sample projects
        await seedEditorAccount();
        await seedDemoProjects();
    }
    else {
        logger.warn(`⚠️ [Database Alert] Postgres health probe degraded: ${dbStatus.error}`);
    }
    // Supabase Storage / admin API — optional, and separate from the
    // database connection above.
    validateSupabaseConfigAtStartup();
    const supabaseStatus = await checkSupabaseHealth();
    if (supabaseStatus.status === 'connected') {
        logger.info(`✅ [Supabase] Storage API reachable for project '${supabaseStatus.projectRef}' (${supabaseStatus.latencyMs}ms)`);
    }
    else if (supabaseStatus.status === 'disconnected') {
        logger.warn(`⚠️ [Supabase Alert] Service role key probe failed: ${supabaseStatus.error}`);
    }
    if (cloudinaryStatus.status === 'connected') {
        logger.info(`✅ [Cloudinary] Cloudinary API connected successfully to '${cloudinaryStatus.cloudName}' (${cloudinaryStatus.latencyMs}ms)`);
    }
    else if (cloudinaryStatus.status === 'unconfigured') {
        logger.warn(`ℹ️ [Cloudinary Note] Cloudinary credentials not fully specified in .env`);
    }
    else {
        logger.warn(`⚠️ [Cloudinary Alert] Cloudinary API probe failed: ${cloudinaryStatus.error}`);
    }
});
// Graceful Shutdown Hooks
const gracefulShutdown = async (signal) => {
    logger.info(`Received ${signal}. Shutting down server gracefully...`);
    await closeDbPool();
    process.exit(0);
};
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
export default app;
