# Performance & Production Guide

Everything changed in this pass, why it matters, and how to deploy it.

---

## 1. What was optimized and why

### Infra layer (index.ts)
| Change | Why |
|---|---|
| **helmet** | Security headers (CSP, X-Content-Type-Options, etc.). Relaxed `crossOriginResourcePolicy` so the Vercel frontend can still load `/uploads` images. |
| **compression (gzip)** | JSON responses shrink ~70–80% → faster downloads, less bandwidth. SSE streams are excluded so they keep streaming. |
| **express-rate-limit** | Stops scrapers/abuse from spiking CPU & memory (which crashes Render Free). Limits: API 600/15min, auth 50/15min, uploads 100/15min (all env-tunable). `trust proxy: 1` so real client IPs are used behind Render's proxy. |
| **Request logger** | Logs every 4xx/5xx + slow (>300ms) request with duration. Set `LOG_ALL_REQUESTS=1` for full logs. |
| **Graceful shutdown** | On Render's SIGTERM, in-flight requests finish and the DB disconnects cleanly instead of mid-response death (`ERR_CONNECTION_CLOSED`). |
| **Server waits for DB before listening** (15s cap) | Kills the classic "works sometimes" bug: traffic used to arrive before the Mongo connection was ready and queries threw. Now the first request always sees a connected DB, or fails fast with a clean JSON error. |
| **CORS allow-list precomputed** | No per-request env parsing. |
| **Static uploads caching** | `/uploads` served with `maxAge: 1d` + ETag → browsers don't re-download images. |

### Database connection (config/db.ts)
- Added `connectTimeoutMS: 10000`, `maxIdleTimeMS: 60000`, `heartbeatFrequencyMS: 10000`.
- `minPoolSize: 2` (was 5) → less idle memory on a 512MB instance.
- **`autoIndex: false` in production** → indexes are NOT rebuilt on every boot, cutting cold-start time. Run `npm run sync-indexes` **once** after deploy to create/verify indexes.

### Auth middleware (60s user-lookup cache)
Every authenticated request used to run `User.findById` just to read `{ email, role }` — a DB round-trip on **every** request. Now the identity is cached in memory for 60s per user:
- Authed endpoints go from ~2 DB queries to 0 after the first call in 60s.
- Role changes (e.g. admin promotion) reflect within 1 minute.
- JWT_SECRET missing in production now logs a loud warning (never ship with the default).

### Queries (controllers)
- **`.lean()`** added to every read query that was missing it (alternatives, launches, leaderboard, category pages, comments, reviews, dashboard, footer…). Lean skips Mongoose document instantiation → 2–10x faster reads.
- **Parallel `Promise.all`** for independent queries (list + count, dashboard counts, profile stats).
- **Batch upvote checks** — instead of loading each product's `upvotedBy` array (can be huge) and scanning it, one indexed `Product.find({ _id: {$in: ids}, upvotedBy: userId })` answers for all products at once.
- **Membership via indexed `exists()`** — `Product.exists({_id, upvotedBy})` / `User.findOne({_id, savedProducts})` avoid pulling arrays over the wire.
- **Fixed N+1s:**
  - Profile reviews: per-review `Product.findById` → one batched `$in` query.
  - Delete comment: recursive per-comment queries → one query per depth level.
  - Notifications to multiple makers: sequential `for` loop → `Promise.all`.
  - Dynamic `await import()` per request (comment/review controllers) → static imports.
- **Field projection** on list endpoints (no more shipping `upvotedBy` then deleting it).
- **Product indexes added:** `upvotedBy`, `makers+status`, `status+topics` for the hot membership/category/alternatives queries.

### Caching (in-memory TTL, zero cost — utils/cache.ts)
| Endpoint | TTL |
|---|---|
| `/api/home` (anonymous) | 60s |
| `/api/footer` | 60s |
| `/api/categories/allCategories`, `navbar`, `search`, `approvedSubcategories`, `select-options` | 60s |
| `/api/dashboard/overview` | 30s |
| `/api/authentication/markers` | 60s |

Cache is invalidated on writes (`cacheDelPrefix`), self-sweeps every 60s, and is hard-capped at 10k entries so memory can't grow unboundedly. Anonymous home page requests now cost **zero DB queries**.

> Move to Redis later only if you scale to 2+ instances. Single instance = in-memory wins.

### Uploads (Cloudinary)
Already good (WebP conversion via sharp, parallel multi-upload). Improvements:
- Upload routes are rate-limited (uploads burn CPU + Cloudinary quota).
- **Images are now capped at 2000px wide** during WebP conversion (`webpMaxWidth` default in `uploadToCloudinary`). A 10MB phone photo no longer uploads at full size — less memory, bandwidth, and Cloudinary storage. Override per-call with `{ webpMaxWidth: 4000 }` if you ever need larger originals.
- JSON body limit reduced to 2MB (uploads use multipart, so this only trims a DoS vector).

---

## 2. Cold starts on Render (requirement 17)

**The #1 cause of your slow first request is Render Free's cold start**, and most of it happens *before your code runs*:

1. **Render Free sleeps after 15 min of inactivity.** The first request after sleep triggers instance provisioning + OS boot + `npm start` → 3–10+ seconds (often 20–60s with a slow disk spin-up).
2. **Module loading:** your bundle loads `sharp`, `socket.io`, `cloudinary`, `mongoose` (~1–2s on a warm instance, more when cold).
3. **DB connection** now happens before listening (fixed — but on cold start the Atlas TLS handshake adds ~0.5–1.5s).

What this code fixes (everything under our control): index auto-build removed, DB wait capped, no awaited file work at boot, compression/caching so even cold responses are small.

What only Render can fix: the instance spin-up itself.

## 3. Do you need to upgrade Free → Starter? (requirement 18)

| | Free | Starter ($7/mo) |
|---|---|---|
| Cold start after idle | Yes (sleeps after 15 min) | **No — never sleeps** |
| First-request latency | 3–60s (cold) | ~100–300ms |
| Instance | 512MB / 0.1 CPU | 512MB / 0.5 CPU |
| Works for a real product? | Barely | Yes |

**Recommendation: yes, upgrade to Starter.** Your two worst symptoms — "first request very slow" and "server sleeps and doesn't respond" — are *exactly* what Starter eliminates. It's $7/mo and turns the API into a consistently fast service. The code optimizations above make Starter's 0.5 CPU go a lot further.

If you must stay on Free, use the keep-alive strategy below — but expect occasional slow first requests regardless.

## 4. Keeping the backend awake without violating Render's policies (requirement 19)

Render's Free tier is *allowed* to be pinged — there is no "no pings" rule; the instance just sleeps after 15 min of zero traffic. A low-frequency uptime ping is the standard, policy-friendly approach:

1. **cron-job.org (free)** → create a job hitting `https://<your-api>.onrender.com/health` **every 10 minutes** (inside the 15-min window so the instance never sleeps).
2. Or **UptimeRobot** (free 50 checks/5min) — same URL.
3. `/health` is deliberately light (no DB query, no rate limit, no compression) — exactly for this.

Caveat: this only prevents *idle* sleeps. If Render restarts the instance for maintenance/deploy, the next request will still be cold. The only true fix is Starter.

## 5. ⚠️ Security: credentials were committed

The old `.env.example` (git-tracked) contained **real Cloudinary API key + secret and a real MongoDB URI with password**. Even though I replaced it with placeholders, they remain in git history. Please:
1. **Rotate the Cloudinary API secret** (Cloudinary dashboard → Settings → API keys → regenerate).
2. **Change the MongoDB database password** (Atlas → Database Access).
3. Confirm `.env` is not tracked: it's in `.gitignore`, but double check with `git ls-files | grep -i env`.

> ⚠️ `NODE_ENV` is intentionally **not** set in `render.yaml`'s env vars — if it were, `npm ci` would skip devDependencies (`tsc` is a devDependency) and the build would fail. Render sets `NODE_ENV=production` automatically at runtime for Node services. The build command uses `npm ci --include=dev` to be explicit.

## 6. Deployment steps

```bash
# 1. Deploy via render.yaml (Dashboard → New → Blueprint) or manually:
#    Build:   npm ci && npm run build
#    Start:   npm start
#    Health:  /health

# 2. Set env vars in Render: NODE_ENV=production, JWT_SECRET, MONGO_URI,
#    CLOUDINARY_*, ALLOWED_ORIGINS (optional rate-limit tuning).

# 3. After first deploy, create/verify indexes once:
npm run sync-indexes     # requires MONGO_URI in env
```

## 7. Verifying it works

```bash
# Health + cache stats + memory
curl https://<api>.onrender.com/health

# Confirm gzip + rate-limit headers
curl -I -H "Accept-Encoding: gzip" https://<api>.onrender.com/api/faqs/public
```

## 8. What's intentionally NOT changed

- All API response shapes (your frontend is untouched).
- Route paths, auth flow, notification/socket behavior.
- Product status transitions, review/comment logic.
