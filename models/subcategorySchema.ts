import mongoose, { Document, Schema } from "mongoose";
export interface ISubcategory extends Document {
  name: string;
  slug: string;
  description?: string;
  image?: string;
  category: mongoose.Types.ObjectId;
  isActive: boolean;
  status: "waiting" | "rejected" | "approved";
  createdAt: Date;
  updatedAt: Date;
}
const SubcategorySchema = new Schema<ISubcategory>({
  name: {
    type: String,
    required: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
  },
  image: {
    type: String,
    required: false,
  },
  category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
  isActive: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    default: "waiting",
    enum: ["waiting", "rejected", "approved"],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const Subcategory = mongoose.models.Subcategory || mongoose.model<ISubcategory>("Subcategory", SubcategorySchema);
export default Subcategory;
