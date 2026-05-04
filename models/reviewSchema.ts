import mongoose, { Document, Schema } from "mongoose";

export interface IReview extends Document {
  product: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  rating: number;
  title: string;
  content: string;
  pros?: string[];
  cons?: string[];
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  helpfulBy: mongoose.Types.ObjectId[];
  status: "pending" | "approved" | "rejected";
  isEdited: boolean;
  editedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product reference is required"],
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
    },
    title: {
      type: String,
      required: [true, "Review title is required"],
      maxlength: [100, "Title cannot exceed 100 characters"],
      trim: true,
    },
    content: {
      type: String,
      required: [true, "Review content is required"],
      minlength: [10, "Review must be at least 10 characters"],
      maxlength: [2000, "Review cannot exceed 2000 characters"],
      trim: true,
    },
    pros: {
      type: [String],
      default: [],
      validate: {
        validator: function (arr: string[]) {
          return arr.length <= 5;
        },
        message: "Cannot have more than 5 pros",
      },
    },
    cons: {
      type: [String],
      default: [],
      validate: {
        validator: function (arr: string[]) {
          return arr.length <= 5;
        },
        message: "Cannot have more than 5 cons",
      },
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: false,
    },
    helpfulCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    helpfulBy: {
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
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure one review per user per product
ReviewSchema.index({ product: 1, user: 1 }, { unique: true });

// Index for better query performance
ReviewSchema.index({ product: 1, rating: -1 });
ReviewSchema.index({ product: 1, helpfulCount: -1 });
ReviewSchema.index({ user: 1, createdAt: -1 });

const Review = mongoose.models.Review || mongoose.model<IReview>("Review", ReviewSchema);
export default Review;
