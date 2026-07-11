import { Request, Response } from "express";
import mongoose from "mongoose";
import Notification, { NotificationType, INotification } from "../models/notificationSchema.js";
import User from "../models/userSchema.js";
import { AuthRequest } from "../middleware/authMiddleware.js";
import { emitNotification, emitUnreadCount } from "../config/socket.js";

// ─── Internal helper ─────────────────────────────────────────────────────────
export async function createNotification(payload: {
  recipient: string;
  actor: string;
  type: NotificationType;
  message: string;
  entityId?: string;
  entityType?: INotification["entityType"];
  link?: string;
}): Promise<void> {
  try {
    // Never notify yourself
    if (payload.recipient === payload.actor) return;
    const note = await Notification.create(payload) as mongoose.Document & INotification;

    // Populate actor for the real-time event
    await note.populate("actor", "fullname username profileImage");

    const actor = note.actor as any;
    emitNotification(payload.recipient, {
      _id: note._id.toString(),
      type: note.type,
      message: note.message,
      actor: {
        _id: actor._id?.toString() || payload.actor,
        fullname: actor.fullname || "",
        username: actor.username || "",
        profileImage: actor.profileImage,
      },
      entityId: note.entityId?.toString(),
      entityType: note.entityType,
      link: note.link,
      read: false,
      createdAt: note.createdAt.toISOString(),
    });

    // Also push the updated unread count
    const count = await Notification.countDocuments({ recipient: payload.recipient, read: false });
    emitUnreadCount(payload.recipient, count);
  } catch (err) {
    console.error("[Notification] create error:", err);
  }
}

// ─── POST /api/notifications ──────────────────────────────────────────────────
export async function createNotificationController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { recipient, type, message, entityId, entityType, link } = req.body;
    const actor = req.user!.id;

    if (!recipient || !type || !message) {
      res.status(400).json({ success: false, message: "recipient, type and message are required" });
      return;
    }

    const recipientUser = await User.findById(recipient);
    if (!recipientUser) {
      res.status(404).json({ success: false, message: "Recipient not found" });
      return;
    }

    const note = await Notification.create({
      recipient,
      actor,
      type,
      message,
      entityId: entityId && mongoose.Types.ObjectId.isValid(entityId) ? entityId : undefined,
      entityType: entityType || undefined,
      link: link || "",
    }) as mongoose.Document & INotification;

    await note.populate("actor", "fullname username profileImage");
    res.status(201).json({ success: true, data: note });
  } catch (error) {
    console.error("createNotification error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─── GET /api/notifications ───────────────────────────────────────────────────
export async function getNotificationsController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.user!.id;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const page  = Math.max(Number(req.query.page)  || 1, 1);
    const skip  = (page - 1) * limit;
    const unreadOnly = req.query.unreadOnly === "true";

    const filter: any = { recipient: userId };
    if (unreadOnly) filter.read = false;

    const [items, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("actor", "fullname username profileImage"),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipient: userId, read: false }),
    ]);

    res.json({ success: true, data: items, meta: { total, page, limit, unreadCount } });
  } catch (error) {
    console.error("getNotifications error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─── GET /api/notifications/unread-count ─────────────────────────────────────
export async function getUnreadCountController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const count = await Notification.countDocuments({ recipient: req.user!.id, read: false });
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─── PATCH /api/notifications/:id/read ───────────────────────────────────────
export async function markAsReadController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const note = await Notification.findById(req.params.id);
    if (!note) { res.status(404).json({ success: false, message: "Not found" }); return; }
    if (note.recipient.toString() !== req.user!.id && req.user!.role !== "admin") {
      res.status(403).json({ success: false, message: "Access denied" }); return;
    }
    note.read = true;
    await note.save();
    // Push updated unread count
    const count = await Notification.countDocuments({ recipient: req.user!.id, read: false });
    emitUnreadCount(req.user!.id, count);
    res.json({ success: true, data: note });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─── PATCH /api/notifications/read-all ───────────────────────────────────────
export async function markAllReadController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    await Notification.updateMany({ recipient: req.user!.id, read: false }, { $set: { read: true } });
    emitUnreadCount(req.user!.id, 0);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─── DELETE /api/notifications/:id ───────────────────────────────────────────
export async function deleteNotificationController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const note = await Notification.findById(req.params.id);
    if (!note) { res.status(404).json({ success: false, message: "Not found" }); return; }
    if (note.recipient.toString() !== req.user!.id && req.user!.role !== "admin") {
      res.status(403).json({ success: false, message: "Access denied" }); return;
    }
    await note.deleteOne();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─── DELETE /api/notifications/clear-all ─────────────────────────────────────
export async function clearAllNotificationsController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    await Notification.deleteMany({ recipient: req.user!.id });
    emitUnreadCount(req.user!.id, 0);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─── Internal: remove a specific notification on un-upvote/un-react ──────────
export async function removeNotificationIfExists(opts: {
  recipient: string;
  actor: string;
  type: NotificationType;
  entityId: string;
}): Promise<void> {
  try {
    const deleted = await Notification.findOneAndDelete({
      recipient: opts.recipient,
      actor:     opts.actor,
      type:      opts.type,
      entityId:  opts.entityId,
    });

    // If a notification was actually removed, emit the updated unread count
    if (deleted) {
      const count = await Notification.countDocuments({ recipient: opts.recipient, read: false });
      emitUnreadCount(opts.recipient, count);
      console.log(
        `[Notification] Removed notification (${opts.type}) for user ${opts.recipient}, unread count: ${count}`
      );
    }
  } catch (err) {
    console.error("[Notification] removeNotificationIfExists error:", err);
  }
}

// ─── Internal: send a notification only if one doesn't already exist ──────────
export async function upsertNotification(payload: {
  recipient: string;
  actor: string;
  type: NotificationType;
  message: string;
  entityId?: string;
  entityType?: INotification["entityType"];
  link?: string;
}): Promise<void> {
  try {
    if (payload.recipient === payload.actor) return;
    // If already exists, update message and reset read; otherwise create
    const existing = await Notification.findOneAndUpdate(
      {
        recipient: payload.recipient,
        actor:     payload.actor,
        type:      payload.type,
        entityId:  payload.entityId,
      },
      {
        $set: {
          message:    payload.message,
          entityType: payload.entityType,
          link:       payload.link,
          read:       false,
          updatedAt:  new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ) as mongoose.Document & INotification | null;

    const note = existing || (await Notification.findOne({
      recipient: payload.recipient,
      actor:     payload.actor,
      type:      payload.type,
      entityId:  payload.entityId,
    }));
    if (!note) return;

    await note.populate("actor", "fullname username profileImage");
    const actor = note.actor as any;
    emitNotification(payload.recipient, {
      _id:        note._id.toString(),
      type:       note.type,
      message:    note.message,
      actor: {
        _id:          actor._id?.toString() || payload.actor,
        fullname:     actor.fullname  || "",
        username:     actor.username  || "",
        profileImage: actor.profileImage,
      },
      entityId:   note.entityId?.toString(),
      entityType: note.entityType,
      link:       note.link,
      read:       false,
      createdAt:  note.createdAt.toISOString(),
    });

    const count = await Notification.countDocuments({ recipient: payload.recipient, read: false });
    emitUnreadCount(payload.recipient, count);
  } catch (err) {
    console.error("[Notification] upsertNotification error:", err);
  }
}

// ─── Admin: GET /api/notifications/admin/all ─────────────────────────────────
export async function adminGetAllNotificationsController(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    if (req.user!.role !== "admin") {
      res.status(403).json({ success: false, message: "Admin only" }); return;
    }
    const limit = Math.min(Number(req.query.limit) || 30, 200);
    const page  = Math.max(Number(req.query.page)  || 1, 1);
    const skip  = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Notification.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("actor",     "fullname username profileImage")
        .populate("recipient", "fullname username profileImage"),
      Notification.countDocuments(),
    ]);

    res.json({ success: true, data: items, meta: { total, page, limit } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
}

