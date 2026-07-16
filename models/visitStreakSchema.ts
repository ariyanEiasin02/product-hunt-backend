import mongoose, { Document, Schema } from "mongoose";

export interface IVisitStreak extends Document {
  user: mongoose.Types.ObjectId;
  currentStreak: number;
  longestStreak: number;
  lastVisitDate: Date;
  visitDates: Date[];
  totalVisits: number;
  createdAt: Date;
  updatedAt: Date;
}

const VisitStreakSchema = new Schema<IVisitStreak>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    currentStreak: {
      type: Number,
      default: 0,
    },
    longestStreak: {
      type: Number,
      default: 0,
    },
    lastVisitDate: {
      type: Date,
      default: null,
    },
    visitDates: {
      type: [Date],
      default: [],
    },
    totalVisits: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for leaderboard queries
VisitStreakSchema.index({ longestStreak: -1, currentStreak: -1 });
VisitStreakSchema.index({ currentStreak: -1 });
// Note: user index is already created by unique: true on the user field

const VisitStreak = mongoose.model<IVisitStreak>("VisitStreak", VisitStreakSchema);
export default VisitStreak;
