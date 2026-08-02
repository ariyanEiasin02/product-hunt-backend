import { Request, Response, NextFunction } from "express";

/**
 * Minimal, dependency-free request logger.
 *
 * Logs method, path, status, duration and bytes for every request.
 * In production we only log slow requests (>= 300ms) plus every 5xx/4xx
 * error, so the log volume stays low while still surfacing problems.
 * Set LOG_ALL_REQUESTS=1 to log everything.
 */

const SLOW_MS = Number(process.env.LOG_SLOW_MS || 300);

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const { method, originalUrl } = req;
    const status = res.statusCode;

    const isError = status >= 400;
    const isSlow = durationMs >= SLOW_MS;
    const logAll = process.env.LOG_ALL_REQUESTS === "1";

    if (logAll || isError || isSlow) {
      const line = `${method} ${originalUrl} ${status} ${durationMs.toFixed(1)}ms ${res.getHeader("content-length") || "-"}B`;
      if (status >= 500) console.error(`[req] ${line}`);
      else if (status >= 400) console.warn(`[req] ${line}`);
      else console.log(`[req] ${line}`);
    }
  });

  next();
}

export default requestLogger;
