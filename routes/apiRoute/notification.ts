import { Router } from "express";
import {
  createNotificationController,
  getNotificationsController,
  getUnreadCountController,
  markAsReadController,
  markAllReadController,
  deleteNotificationController,
  clearAllNotificationsController,
  adminGetAllNotificationsController,
  followUserController,
} from "../../controllers/notificationController.js";
import { verifyToken } from "../../middleware/authMiddleware.js";

const router = Router();

// ── User notifications ──────────────────────────────────────────────────────
// GET  /api/notifications
router.get("/", verifyToken, getNotificationsController);

// GET  /api/notifications/unread-count
router.get("/unread-count", verifyToken, getUnreadCountController);

// PATCH /api/notifications/read-all   (must be before /:id)
router.patch("/read-all", verifyToken, markAllReadController);

// DELETE /api/notifications/clear-all (must be before /:id)
router.delete("/clear-all",   verifyToken, clearAllNotificationsController);

// POST /api/notifications
router.post("/", verifyToken, createNotificationController);

// PATCH /api/notifications/:id/read
router.patch("/:id/read", verifyToken, markAsReadController);

// DELETE /api/notifications/:id
router.delete("/:id",verifyToken, deleteNotificationController);

// ── Follow / Unfollow ───────────────────────────────────────────────────────
// POST /api/notifications/follow/:userId
router.post("/follow/:userId", verifyToken, followUserController);

// ── Admin ───────────────────────────────────────────────────────────────────
// GET /api/notifications/admin/all
router.get("/admin/all",verifyToken, adminGetAllNotificationsController);

export default router;