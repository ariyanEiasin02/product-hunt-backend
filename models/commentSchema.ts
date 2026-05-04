import mongoose, { Document, Schema } from "mongoose";

export interface IComment extends Document {
  product: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  content: string;
  parentComment?: mongoose.Types.ObjectId;
  replyCount: number;
  upvotes: number;
  upvotedBy: mongoose.Types.ObjectId[];
  status: "pending" | "approved" | "rejected";
  isEdited: boolean;
  editedAt?: Date;
  isPinned: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product ID is required"],
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    content: {
      type: String,
      required: [true, "Comment content is required"],
      trim: true,
      minlength: [1, "Comment cannot be empty"],
      maxlength: [2000, "Comment cannot exceed 2000 characters"],
    },
    parentComment: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
      index: true,
    },
    replyCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    upvotes: {
      type: Number,
      default: 0,
      min: 0,
    },
    upvotedBy: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
      index: true,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
CommentSchema.index({ product: 1, parentComment: 1, createdAt: -1 });
CommentSchema.index({ product: 1, isPinned: -1, upvotes: -1 });
CommentSchema.index({ user: 1, createdAt: -1 });
CommentSchema.index({ parentComment: 1, createdAt: 1 });
CommentSchema.index({ isDeleted: 1, product: 1 });

const Comment = mongoose.models.Comment || mongoose.model<IComment>("Comment", CommentSchema);
export default Comment;
