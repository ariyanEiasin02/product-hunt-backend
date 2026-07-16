import mongoose, { Document, Schema } from "mongoose";

export interface IProduct extends Document {
  name: string;
  tagline: string;
  slug: string;
  description: string;
  links: {
    website: string;
    appStore?: string;
    playStore?: string;
    demo?: string;
    video?: string;
    github?: string;
  };
  thumbnail: string;
  gallery?: string[];
  firstComment?: string;
  makers: mongoose.Types.ObjectId[];
  topics: mongoose.Types.ObjectId[]; 
  pricingType?: "free" | "paid" | "freemium" | "paid_with_free_trial";
  isOpenSource?: boolean;
  isAiProduct?: boolean;
  status: "draft" | "pending" | "approved" | "rejected";
  scheduledLaunchDate?: Date;
  launchedAt?: Date;
  upvotes: number;
  upvotedBy: mongoose.Types.ObjectId[];
  commentsCount: number;
  averageRating: number;
  totalReviews: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      maxlength: [40, "Product name cannot exceed 40 characters"],
      trim: true,
    },
    tagline: {
      type: String,
      required: [true, "Tagline is required"],
      maxlength: [60, "Tagline cannot exceed 60 characters"],
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    links: {
      website: {
        type: String,
        required: [true, "Website link is required"],
        trim: true,
      },
    },
    thumbnail: {
      type: String,
      required: [true, "Thumbnail is required"],
    },
    gallery: {
      type: [String],
      default: [],
      validate: {
        validator: function (arr: string[]) {
          return arr.length <= 10;
        },
        message: "Gallery cannot have more than 10 images",
      },
    },
    firstComment: {
      type: String,
      trim: true,
      maxlength: [2000, "First comment cannot exceed 2000 characters"],
    },
    makers: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      validate: {
        validator: function (arr: mongoose.Types.ObjectId[]) {
          return arr && arr.length > 0;
        },
        message: "At least one maker is required",
      },
    },
    topics: {
      type: [Schema.Types.ObjectId],
      ref: "Subcategory",
      required: [true, "At least one category is required"],
      validate: {
        validator: function (arr: mongoose.Types.ObjectId[]) {
          return arr && arr.length > 0 && arr.length <= 3;
        },
        message: "Products must have between 1 and 3 categories",
      },
    },
    pricingType: {
      type: String,
      enum: ["free", "paid", "freemium", "paid_with_free_trial"],
    },
    isOpenSource: {
      type: Boolean,
      default: false,
    },
    isAiProduct: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected"],
      default: "pending",
    },
    scheduledLaunchDate: {
      type: Date,
    },
    launchedAt: {
      type: Date,
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
    commentsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to generate slug from name if not provided
ProductSchema.pre("save", function () {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
});

// Index for better query performance
ProductSchema.index({ status: 1, launchedAt: -1 });
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ topics: 1 });
ProductSchema.index({ upvotes: -1 });

const Product = mongoose.models.Product || mongoose.model<IProduct>("Product", ProductSchema);
export default Product;
