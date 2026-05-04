import { Request, Response } from "express";
import Product from "../models/productSchema.js";

/**
 * GET /api/leaderboard
 * Query params:
 *   period: "daily" | "weekly" | "monthly" | "yearly"
 *   year:   number (required)
 *   month:  number (required for daily, weekly, monthly)
 *   day:    number (required for daily, weekly)
 *   tab:    "featured" | "all" (default: "featured")
 *   page:   number (default: 1)
 *   limit:  number (default: 20)
 *
 * tab=featured → only products with upvotes >= 1
 * tab=all      → ALL approved products in that date range (no upvote filter)
 */
export async function getLeaderboardController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const {
      period = "daily",
      year,
      month,
      day,
      tab = "featured",
      page = "1",
      limit = "20",
    } = req.query;

    const yearNum = parseInt(year as string);
    const monthNum = parseInt(month as string);
    const dayNum = parseInt(day as string);
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;

    if (!yearNum || isNaN(yearNum)) {
      res.status(400).json({ success: false, message: "Year is required" });
      return;
    }

    let startDate: Date;
    let endDate: Date;

    switch (period) {
      case "daily": {
        if (!monthNum || !dayNum || isNaN(monthNum) || isNaN(dayNum)) {
          res.status(400).json({ success: false, message: "Month and day are required for daily period" });
          return;
        }
        startDate = new Date(yearNum, monthNum - 1, dayNum, 0, 0, 0, 0);
        endDate = new Date(yearNum, monthNum - 1, dayNum, 23, 59, 59, 999);
        break;
      }

      case "weekly": {
        if (!monthNum || !dayNum || isNaN(monthNum) || isNaN(dayNum)) {
          res.status(400).json({ success: false, message: "Month and day are required for weekly period" });
          return;
        }
        // Find the Monday of the week containing the given date
        const targetDate = new Date(yearNum, monthNum - 1, dayNum);
        const dayOfWeek = targetDate.getDay(); // 0=Sun, 1=Mon, ...
        const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        startDate = new Date(targetDate);
        startDate.setDate(startDate.getDate() + daysToMonday);
        startDate.setHours(0, 0, 0, 0);

        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      }

      case "monthly": {
        if (!monthNum || isNaN(monthNum)) {
          res.status(400).json({ success: false, message: "Month is required for monthly period" });
          return;
        }
        startDate = new Date(yearNum, monthNum - 1, 1, 0, 0, 0, 0);
        endDate = new Date(yearNum, monthNum, 0, 23, 59, 59, 999); // last day of month
        break;
      }

      case "yearly": {
        startDate = new Date(yearNum, 0, 1, 0, 0, 0, 0);
        endDate = new Date(yearNum, 11, 31, 23, 59, 59, 999);
        break;
      }

      default: {
        res.status(400).json({ success: false, message: "Invalid period. Use: daily, weekly, monthly, yearly" });
        return;
      }
    }

    // Don't allow future start dates
    const now = new Date();
    if (startDate > now) {
      res.status(400).json({ success: false, message: "Cannot query future dates" });
      return;
    }

    // Cap end date to now if it's in the future
    if (endDate > now) {
      endDate = now;
    }

    // Build query — match products whose effective launch date falls in range
    // Use launchedAt if it exists, otherwise fall back to createdAt
    const dateFilter = {
      $or: [
        // Products with a launchedAt date in the range
        {
          launchedAt: { $exists: true, $ne: null, $gte: startDate, $lte: endDate },
        },
        // Products without launchedAt — use createdAt instead
        {
          $and: [
            { $or: [{ launchedAt: null }, { launchedAt: { $exists: false } }] },
            { createdAt: { $gte: startDate, $lte: endDate } },
          ],
        },
      ],
    };

    const matchQuery: any = {
      status: "approved",
      ...dateFilter,
    };

    // tab=featured → only products with upvotes >= 1
    // tab=all      → ALL products (no upvote filter)
    if (tab === "featured") {
      matchQuery.upvotes = { $gte: 1 };
    }

    const userId = (req as any).user?.id || null;

    // Sort: featured tab by upvotes desc, all tab by createdAt/launchedAt desc
    const sortCriteria: any =
      tab === "featured"
        ? { upvotes: -1, commentsCount: -1, launchedAt: -1, createdAt: -1 }
        : { launchedAt: -1, createdAt: -1, upvotes: -1 };

    const [products, totalCount] = await Promise.all([
      Product.find(matchQuery)
        .select("name slug tagline thumbnail upvotes commentsCount topics upvotedBy launchedAt createdAt")
        .populate("topics", "name slug")
        .sort(sortCriteria)
        .skip(skip)
        .limit(limitNum),
      Product.countDocuments(matchQuery),
    ]);

    // Add rank and upvoteTrue flag
    const rankedProducts = products.map((product, index) => {
      const productObj = product.toObject();
      return {
        ...productObj,
        rank: skip + index + 1,
        upvoteTrue: userId
          ? productObj.upvotedBy?.some(
              (id: any) => id.toString() === userId
            )
            ? 1
            : 0
          : 0,
      };
    });

    // Remove upvotedBy from response (it can be large)
    rankedProducts.forEach((p: any) => delete p.upvotedBy);

    res.status(200).json({
      success: true,
      data: {
        products: rankedProducts,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalCount / limitNum),
          totalCount,
          hasMore: skip + limitNum < totalCount,
        },
        period,
        tab,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      },
    });
  } catch (error: any) {
    console.error("Leaderboard error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch leaderboard",
      error: error.message,
    });
  }
}
