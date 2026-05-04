import { Request, Response } from "express";
import VisitStreak from "../models/visitStreakSchema.js";
import User from "../models/userSchema.js";

/**
 * Record a visit and update streak
 * POST /api/visit-streaks/record
 */
export async function recordVisitController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let visitStreak = await VisitStreak.findOne({ user: userId });

    if (!visitStreak) {
      // First visit ever
      visitStreak = await VisitStreak.create({
        user: userId,
        currentStreak: 1,
        longestStreak: 1,
        lastVisitDate: today,
        visitDates: [today],
        totalVisits: 1,
      });
    } else {
      const lastVisit = visitStreak.lastVisitDate
        ? new Date(visitStreak.lastVisitDate.getFullYear(), visitStreak.lastVisitDate.getMonth(), visitStreak.lastVisitDate.getDate())
        : null;

      // Check if already visited today
      if (lastVisit && lastVisit.getTime() === today.getTime()) {
        res.status(200).json({
          success: true,
          message: "Already recorded today",
          data: {
            currentStreak: visitStreak.currentStreak,
            longestStreak: visitStreak.longestStreak,
            totalVisits: visitStreak.totalVisits,
            lastVisitDate: visitStreak.lastVisitDate,
          },
        });
        return;
      }

      // Calculate days since last visit
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (lastVisit && lastVisit.getTime() === yesterday.getTime()) {
        // Consecutive day - increase streak
        visitStreak.currentStreak += 1;
        if (visitStreak.currentStreak > visitStreak.longestStreak) {
          visitStreak.longestStreak = visitStreak.currentStreak;
        }
      } else {
        // Streak broken - reset to 1
        visitStreak.currentStreak = 1;
      }

      visitStreak.lastVisitDate = today;
      visitStreak.totalVisits += 1;
      
      // Keep only last 30 visit dates for display
      visitStreak.visitDates.push(today);
      if (visitStreak.visitDates.length > 30) {
        visitStreak.visitDates = visitStreak.visitDates.slice(-30);
      }

      await visitStreak.save();
    }

    res.status(200).json({
      success: true,
      message: "Visit recorded",
      data: {
        currentStreak: visitStreak.currentStreak,
        longestStreak: visitStreak.longestStreak,
        totalVisits: visitStreak.totalVisits,
        lastVisitDate: visitStreak.lastVisitDate,
      },
    });
  } catch (error: any) {
    console.error("Record visit error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to record visit",
      error: error.message,
    });
  }
}

/**
 * Get current user's streak info
 * GET /api/visit-streaks/me
 */
export async function getMyStreakController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const visitStreak = await VisitStreak.findOne({ user: userId });

    if (!visitStreak) {
      res.status(200).json({
        success: true,
        data: {
          currentStreak: 0,
          longestStreak: 0,
          totalVisits: 0,
          lastVisitDate: null,
          visitDates: [],
        },
      });
      return;
    }

    // Check if streak is still valid (visited yesterday or today)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const lastVisit = visitStreak.lastVisitDate
      ? new Date(visitStreak.lastVisitDate.getFullYear(), visitStreak.lastVisitDate.getMonth(), visitStreak.lastVisitDate.getDate())
      : null;

    let currentStreak = visitStreak.currentStreak;
    
    // If last visit was before yesterday, streak is broken
    if (lastVisit && lastVisit.getTime() < yesterday.getTime()) {
      currentStreak = 0;
      // Update in database
      visitStreak.currentStreak = 0;
      await visitStreak.save();
    }

    res.status(200).json({
      success: true,
      data: {
        currentStreak,
        longestStreak: visitStreak.longestStreak,
        totalVisits: visitStreak.totalVisits,
        lastVisitDate: visitStreak.lastVisitDate,
        visitDates: visitStreak.visitDates.slice(-7), // Last 7 days for progress display
      },
    });
  } catch (error: any) {
    console.error("Get my streak error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get streak info",
      error: error.message,
    });
  }
}

/**
 * Get leaderboard of longest streaks
 * GET /api/visit-streaks/leaderboard
 */
export async function getStreakLeaderboardController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { sort = "longest", page = "1", limit = "20" } = req.query;
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;

    const userId = (req as any).user?.id || null;

    // Build sort criteria
    const sortCriteria: any = sort === "current" 
      ? { currentStreak: -1, longestStreak: -1 } 
      : { longestStreak: -1, currentStreak: -1 };

    const [streaks, totalCount] = await Promise.all([
      VisitStreak.find({ 
        $or: [
          { longestStreak: { $gte: 1 } },
          { currentStreak: { $gte: 1 } }
        ]
      })
        .populate("user", "fullname username profileImage headline")
        .sort(sortCriteria)
        .skip(skip)
        .limit(limitNum),
      VisitStreak.countDocuments({
        $or: [
          { longestStreak: { $gte: 1 } },
          { currentStreak: { $gte: 1 } }
        ]
      }),
    ]);

    // Get current user's following list if logged in
    let followingList: string[] = [];
    if (userId) {
      const currentUser = await User.findById(userId).select("following");
      followingList = (currentUser?.following || []).map((id: any) => id.toString());
    }

    // Format response with rank and following status
    const leaderboard = streaks.map((streak, index) => {
      const user = streak.user as any;
      return {
        rank: skip + index + 1,
        userId: user._id,
        fullname: user.fullname,
        username: user.username,
        profileImage: user.profileImage,
        headline: user.headline,
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        totalVisits: streak.totalVisits,
        isFollowing: userId ? followingList.includes(user._id.toString()) : false,
        isCurrentUser: userId ? user._id.toString() === userId : false,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        leaderboard,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalCount / limitNum),
          totalCount,
          hasMore: skip + limitNum < totalCount,
        },
      },
    });
  } catch (error: any) {
    console.error("Leaderboard error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get leaderboard",
      error: error.message,
    });
  }
}

/**
 * Follow a user
 * POST /api/visit-streaks/follow/:userId
 */
export async function followUserController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const currentUserId = (req as any).user?.id;
    const { userId: targetUserId } = req.params;

    if (!currentUserId) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    if (currentUserId === targetUserId) {
      res.status(400).json({ success: false, message: "Cannot follow yourself" });
      return;
    }

    const [currentUser, targetUser] = await Promise.all([
      User.findById(currentUserId),
      User.findById(targetUserId),
    ]);

    if (!currentUser || !targetUser) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    // Check if already following
    const isFollowing = currentUser.following?.some(
      (id) => id.toString() === targetUserId
    );

    if (isFollowing) {
      res.status(400).json({ success: false, message: "Already following this user" });
      return;
    }

    // Add to following/followers lists
    await Promise.all([
      User.findByIdAndUpdate(currentUserId, {
        $addToSet: { following: targetUserId },
      }),
      User.findByIdAndUpdate(targetUserId, {
        $addToSet: { followers: currentUserId },
      }),
    ]);

    res.status(200).json({
      success: true,
      message: "Successfully followed user",
      data: { isFollowing: true },
    });
  } catch (error: any) {
    console.error("Follow user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to follow user",
      error: error.message,
    });
  }
}

/**
 * Unfollow a user
 * DELETE /api/visit-streaks/follow/:userId
 */
export async function unfollowUserController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const currentUserId = (req as any).user?.id;
    const { userId: targetUserId } = req.params;

    if (!currentUserId) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    if (currentUserId === targetUserId) {
      res.status(400).json({ success: false, message: "Cannot unfollow yourself" });
      return;
    }

    // Remove from following/followers lists
    await Promise.all([
      User.findByIdAndUpdate(currentUserId, {
        $pull: { following: targetUserId },
      }),
      User.findByIdAndUpdate(targetUserId, {
        $pull: { followers: currentUserId },
      }),
    ]);

    res.status(200).json({
      success: true,
      message: "Successfully unfollowed user",
      data: { isFollowing: false },
    });
  } catch (error: any) {
    console.error("Unfollow user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to unfollow user",
      error: error.message,
    });
  }
}

/**
 * Get visit streaks stats for admin dashboard
 * GET /api/visit-streaks/admin/stats
 */
export async function getAdminStreakStatsController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const [
      totalUsers,
      activeStreaks,
      topStreaks,
      recentActivity,
    ] = await Promise.all([
      VisitStreak.countDocuments(),
      VisitStreak.countDocuments({ currentStreak: { $gte: 1 } }),
      VisitStreak.find()
        .populate("user", "fullname username profileImage")
        .sort({ longestStreak: -1 })
        .limit(10),
      VisitStreak.find()
        .populate("user", "fullname username profileImage")
        .sort({ lastVisitDate: -1 })
        .limit(10),
    ]);

    // Calculate average streak
    const avgResult = await VisitStreak.aggregate([
      { $match: { currentStreak: { $gte: 1 } } },
      { $group: { _id: null, avgStreak: { $avg: "$currentStreak" } } },
    ]);
    const averageStreak = avgResult[0]?.avgStreak || 0;

    // Streak distribution
    const distribution = await VisitStreak.aggregate([
      {
        $bucket: {
          groupBy: "$longestStreak",
          boundaries: [0, 7, 30, 90, 180, 365, Infinity],
          default: "365+",
          output: { count: { $sum: 1 } },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        activeStreaks,
        averageStreak: Math.round(averageStreak * 10) / 10,
        topStreaks: topStreaks.map((s) => ({
          user: s.user,
          currentStreak: s.currentStreak,
          longestStreak: s.longestStreak,
          totalVisits: s.totalVisits,
        })),
        recentActivity: recentActivity.map((s) => ({
          user: s.user,
          currentStreak: s.currentStreak,
          lastVisitDate: s.lastVisitDate,
        })),
        distribution,
      },
    });
  } catch (error: any) {
    console.error("Admin stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get admin stats",
      error: error.message,
    });
  }
}

/**
 * Get all visit streaks for admin (paginated)
 * GET /api/visit-streaks/admin/all
 */
export async function getAdminAllStreaksController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { page = "1", limit = "20", search = "" } = req.query;
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;

    let userFilter: any = {};
    if (search) {
      const searchRegex = new RegExp(search as string, "i");
      const users = await User.find()
        .or([
          { fullname: searchRegex },
          { username: searchRegex },
          { email: searchRegex },
        ])
        .select("_id");
      const userIds = users.map((u) => u._id);
      userFilter = { user: { $in: userIds } };
    }

    const [streaks, totalCount] = await Promise.all([
      VisitStreak.find(userFilter)
        .populate("user", "fullname username email profileImage")
        .sort({ longestStreak: -1 })
        .skip(skip)
        .limit(limitNum),
      VisitStreak.countDocuments(userFilter),
    ]);

    res.status(200).json({
      success: true,
      data: streaks,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalCount,
        hasMore: skip + limitNum < totalCount,
      },
    });
  } catch (error: any) {
    console.error("Admin all streaks error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get all streaks",
      error: error.message,
    });
  }
}
