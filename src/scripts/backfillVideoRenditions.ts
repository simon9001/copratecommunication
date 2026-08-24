/**
 * Backfill adaptive-streaming renditions for videos already in Cloudinary.
 *
 * New uploads request their HLS ladder + MP4 fallbacks eagerly at upload time.
 * Anything uploaded before that change has only the original master, so the first
 * viewer to open it triggers an on-demand transcode of a 300-500 MB file — which
 * is exactly the stall this whole change set exists to remove.
 *
 * This walks every video asset in the account and queues the same derived
 * renditions asynchronously. Cloudinary processes them in the background; the
 * script only enqueues, so it returns quickly even for large libraries.
 *
 * Run with:  pnpm media:backfill
 */

import { v2 as cloudinary } from 'cloudinary'
import { env } from '../config/env.js'

if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
  console.error('[backfill] Cloudinary credentials missing from environment. Aborting.')
  process.exit(1)
}

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
})

// Must stay in sync with VIDEO_EAGER_TRANSFORMS in services/cloudinary.service.ts
// and with the URL builders in the frontend's utils/cloudinaryVideo.js.
const TRANSFORMS = [
  'sp_auto',
  'f_mp4,vc_auto,q_auto,w_1280,c_limit,ac_aac',
  'f_mp4,vc_auto,q_auto:eco,w_960,c_limit,br_900k,ac_none',
]

async function backfill() {
  let nextCursor: string | undefined
  let total = 0
  let queued = 0
  let failed = 0

  do {
    const page = await cloudinary.api.resources({
      resource_type: 'video',
      type: 'upload',
      max_results: 100,
      next_cursor: nextCursor,
    })

    for (const asset of page.resources as Array<{ public_id: string; bytes: number }>) {
      total += 1
      try {
        await cloudinary.uploader.explicit(asset.public_id, {
          type: 'upload',
          resource_type: 'video',
          eager: TRANSFORMS.map((transformation) => ({ raw_transformation: transformation })),
          eager_async: true,
        })
        queued += 1
        const mb = (asset.bytes / 1024 / 1024).toFixed(1)
        console.log(`[backfill] queued ${asset.public_id} (${mb} MB)`)
      } catch (err: any) {
        failed += 1
        console.error(`[backfill] FAILED ${asset.public_id}: ${err?.message || err}`)
      }
    }

    nextCursor = page.next_cursor
  } while (nextCursor)

  console.log(`\n[backfill] done — ${queued}/${total} queued, ${failed} failed.`)
  console.log('[backfill] Cloudinary encodes these in the background; large masters')
  console.log('[backfill] can take several minutes each before HLS playback is live.')
}

backfill().catch((err) => {
  console.error('[backfill] fatal:', err)
  process.exit(1)
})
