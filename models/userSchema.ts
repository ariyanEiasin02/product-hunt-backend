import mongoose, { Document, Schema } from "mongoose";
import crypto from "crypto";

export interface IUser extends Document {
  fullname: string;
  username: string;
  email: string;
  password: string;
  role: "user" | "admin";
  profileImage: string;
  headline: string;
  about: string;
  website: string;
  socialLinks: string[];
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
  savedProducts?: mongoose.Types.ObjectId[];
  following?: mongoose.Types.ObjectId[];
  followers?: mongoose.Types.ObjectId[];
}

// Generate default avatar URL from name
function generateDefaultAvatar(name: string): string {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(initials)}&backgroundColor=da552f&textColor=ffffff`;
}

// Generate unique username from fullname
function generateUsername(fullname: string): string {
  const base = fullname
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_");
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${base}_${suffix}`;
}

const UserSchema = new Schema<IUser>(
  {
    fullname: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      unique: true,
      sparse: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    profileImage: {
      type: String,
      default: "",
    },
    headline: {
      type: String,
      default: "",
    },
    about: {
      type: String,
      default: "",
    },
    website: {
      type: String,
      default: "",
    },
    socialLinks: {
      type: [String],
      default: [],
    },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    savedProducts: {
      type: [Schema.Types.ObjectId],
      ref: "Product",
      default: [],
    },
    following: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    followers: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save: auto-generate username and default avatar if not set
UserSchema.pre("save", async function () {
  if (this.isNew) {
    if (!this.username) {
      let username = generateUsername(this.fullname);
      const UserModel = mongoose.model("User");
      let exists = await UserModel.findOne({ username });
      while (exists) {
        username = generateUsername(this.fullname);
        exists = await UserModel.findOne({ username });
      }
      this.username = username;
    }
    if (!this.profileImage) {
      this.profileImage = generateDefaultAvatar(this.fullname);
    }
  }
});

const User = mongoose.model<IUser>("User", UserSchema);
export default User;
