import { config } from 'dotenv'
import { z } from 'zod'

// Load environment variables from .env file
config()

const envSchema = z.object({
  PORT: z.string().default('3000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // SQL Server Configuration
  DB_USER: z.string().min(1, 'DB_USER is required'),
  DB_PASSWORD: z.string().min(1, 'DB_PASSWORD is required'),
  DB_SERVER: z.string().default('127.0.0.1'),
  DB_DATABASE: z.string().default('KeNHA_VR_Projects'),
  DB_PORT: z.string().default('1433').transform((val) => parseInt(val, 10)),
  DB_INSTANCE_NAME: z.string().optional(),
  DB_ENCRYPT: z
    .string()
    .default('false')
    .transform((val) => val.toLowerCase() === 'true'),
  DB_TRUST_SERVER_CERTIFICATE: z
    .string()
    .default('true')
    .transform((val) => val.toLowerCase() === 'true'),

  // JWT Configuration
  JWT_SECRET: z.string().min(8, 'JWT_SECRET must be at least 8 characters'),
  JWT_EXPIRES_IN: z.string().default('24h'),

  // Cloudinary Configuration
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_UPLOAD_PRESET: z.string().optional(),

  // Alerting Configuration
  ALERT_WEBHOOK_URL: z.string().optional(),
})

let envParsed: z.infer<typeof envSchema>

try {
  envParsed = envSchema.parse(process.env)
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Environment configuration validation failed:')
    error.issues.forEach((issue) => {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
    })
  } else {
    console.error('❌ Unknown error while parsing environment variables:', error)
  }
  process.exit(1)
}

export const env = envParsed
