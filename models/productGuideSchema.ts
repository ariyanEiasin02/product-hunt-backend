import mongoose, { Document, Schema } from "mongoose";

export interface IProductGuide extends Document {
  title: string;
  slug: string;
  image: string;
  shortDescription?: string;
  description?: string;
  status: "draft" | "published";
  createdAt: Date;
  updatedAt: Date;
}

const ProductGuideSchema = new Schema<IProductGuide>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    image: {
      type: String,
      default: "",
    },
    shortDescription: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
  },
  { timestamps: true },
);

const ProductGuide: mongoose.Model<IProductGuide> =
  (mongoose.models["ProductGuide"] as mongoose.Model<IProductGuide>) ??
  mongoose.model<IProductGuide>("ProductGuide", ProductGuideSchema);

export default ProductGuide;