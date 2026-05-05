import mongoose, { Document, Schema } from "mongoose";

export type NotificationType =
  | "follow"
  | "unfollow"
  | "upvote_product"
  | "upvote_comment"
  | "upvote_review"
  | "comment"
  | "reply"
  | "review";

export interface INotification extends Document {
  recipient: mongoose.Types.ObjectId;
  actor: mongoose.Types.ObjectId;
  type: NotificationType;
  entityId?: mongoose.Types.ObjectId;
  entityType?: "product" | "comment" | "review" | "user";
  message: string;
  read: boolean;
  link?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    actor:     { type: Schema.Types.ObjectId, ref: "User", required: true },
    type:      { type: String, required: true, enum: ["follow","unfollow","upvote_product","upvote_comment","upvote_review","comment","reply","review"] },
    entityId:  { type: Schema.Types.ObjectId },
    entityType:{ type: String, enum: ["product","comment","review","user"] },
    message:   { type: String, default: "" },
    read:      { type: Boolean, default: false, index: true },
    link:      { type: String, default: "" },
  },
  { timestamps: true }
);

// compound index for fast "my unread" queries
NotificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

const Notification = mongoose.model<INotification>("Notification", NotificationSchema);
export default Notification;