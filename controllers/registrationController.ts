import { Request, Response } from "express";
import User from "../models/userSchema.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import crypto from "crypto";
import { AuthRequest } from "../middleware/authMiddleware.js";
import { createNotification } from "./notificationController.js";

// Simple email validation helper
function emailValidation(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

async function registrationController(req: Request, res: Response): Promise<void> {
  try {
    const { fullname, email, password } = req.body;

    if (!fullname || !email || !password) {
      res.status(400).json({ success: false, message: `${!fullname ? "fullname" : !email ? "email" : "password"} is required field` });
      return;
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ success: false, message: "Email already in use" });
      return;
    }

    if (!emailValidation(email)) {
      res.status(400).json({ success: false, message: "Invalid email format" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      fullname,
      email,
      password: hashedPassword,
    });

    const token = jwt.sign(
      { email: user.email, id: user._id },
      process.env.JWT_SECRET || "secret-key",
      { expiresIn: "7d" }
    );

    res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      data: {
        id: user._id,
        fullname: user.fullname,
        username: user.username,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
        headline: user.headline,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ success: false, message: errorMessage });
  }
}

async function loginController(req: Request, res: Response): Promise<void> {
    try{
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ success: false, message: `${!email ? "email" : "password"} is required field` });
            return;
        }

        const user = await User.findOne({ email });
        if (!user) {
            res.status(401).json({ success: false, message: "Invalid email or password" });
            return;
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            res.status(401).json({ success: false, message: "Invalid email or password" });
            return;
        }

        const token = jwt.sign({ email: user.email, id: user._id }, process.env.JWT_SECRET || "secret-key", {
            expiresIn: "7d",
        });
        
        res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            data: {
                id: user._id,
                fullname: user.fullname,
                username: user.username,
                email: user.email,
                role: user.role,
                profileImage: user.profileImage,
                headline: user.headline,
            },
        });
    }catch(error){
       const errorMessage = error instanceof Error ? error.message : "Unknown error";
       res.status(500).json({ success: false, message: errorMessage });
    }
}

async function allUsersController(req: Request, res: Response): Promise<void> {
    try{
        const page  = Math.max(1, parseInt(String(req.query.page  ?? 1), 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? 20), 10) || 20));
        const skip  = (page - 1) * limit;

        const search = String(req.query.search ?? "").trim();
        const filter = search
            ? { $or: [
                { fullname: { $regex: search, $options: "i" } },
                { email:    { $regex: search, $options: "i" } },
                { username: { $regex: search, $options: "i" } },
              ] }
            : {};

        const [users, total] = await Promise.all([
            User.find(filter).select("-password").sort({ createdAt: -1 }).skip(skip).limit(limit),
            User.countDocuments(filter),
        ]);

        res.status(200).json({
            success: true,
            message: "Users retrieved successfully",
            data: users,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        });
    }catch(error){
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ success: false, message: errorMessage });
    }
}
async function followUserController(req: AuthRequest, res: Response): Promise<void> {
    try{
        const userIdToFollow = req.params.userId;
        const currentUserId = req.user?.id;
        if (!currentUserId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        if (currentUserId === userIdToFollow) {
            res.status(400).json({ success: false, message: "You cannot follow yourself" });
            return;
        }

        const userToFollow = await User.findById(userIdToFollow);
        if (!userToFollow) {
            res.status(404).json({ success: false, message: "User not found" });
            return;
        }

        const currentUser = await User.findById(currentUserId);
        if (!currentUser) {
            res.status(404).json({ success: false, message: "Current user not found" });
            return;
        }

        const isFollowing = currentUser.following?.includes(new mongoose.Types.ObjectId(userIdToFollow)) || false;

        if (isFollowing) {
            // Unfollow: remove from both arrays
            currentUser.following = currentUser.following?.filter(id => id.toString() !== userIdToFollow) || [];
            userToFollow.followers = userToFollow.followers?.filter(id => id.toString() !== currentUserId) || [];
            await currentUser.save();
            await userToFollow.save();
            res.status(200).json({ success: true, message: "User unfollowed successfully", isFollowing: false });
        } else {
            // Follow: add to both arrays
            if (!currentUser.following) currentUser.following = [];
            if (!userToFollow.followers) userToFollow.followers = [];
            currentUser.following.push(new mongoose.Types.ObjectId(userIdToFollow));
            userToFollow.followers.push(new mongoose.Types.ObjectId(currentUserId));
            await currentUser.save();
            await userToFollow.save();

            // Create follow notification
            await createNotification({
                recipient: userIdToFollow,
                actor: currentUserId,
                type: "follow",
                message: `${currentUser.fullname} started following you`,
                entityId: currentUserId,
                entityType: "user",
                link: `/profile/${currentUser.username}`,
            });

            res.status(200).json({ success: true, message: "User followed successfully", isFollowing: true });
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ success: false, message: errorMessage });
    }
}

async function deleteUserController(req: Request, res: Response): Promise<void> {
    try{
        const userId = req.params.id;
        const deletedUser = await User.findByIdAndDelete(userId).select("-password");
        if(!deletedUser){
            res.status(404).json({ success: false, message: "User not found" });
            return;
        }
        res.status(200).json({
            success: true,
            message: "User deleted successfully",
        })
    }catch(error){
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ success: false, message: errorMessage });
    }
}

async function markersController(req: Request, res: Response): Promise<void> {
    try{
        const users = await User.find().select("fullname username profileImage");
        res.status(200).json({
            success: true,
            message: "Users retrieved successfully",
            data: users,
        });
    }catch(error){
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ success: false, message: errorMessage });
    }
}

async function getFollowStatusController(req: AuthRequest, res: Response): Promise<void> {
    try {
        const currentUserId = req.user?.id;
        if (!currentUserId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }

        const { userIds } = req.query;
        if (!userIds || typeof userIds !== 'string') {
            res.status(400).json({ success: false, message: "userIds parameter is required" });
            return;
        }

        const userIdArray = userIds.split(',').map(id => id.trim());
        const currentUser = await User.findById(currentUserId).select("following");

        if (!currentUser) {
            res.status(404).json({ success: false, message: "Current user not found" });
            return;
        }

        const followingMap: Record<string, boolean> = {};
        userIdArray.forEach(userId => {
            followingMap[userId] = currentUser.following?.some(
                followId => followId.toString() === userId
            ) || false;
        });

        res.status(200).json({
            success: true,
            data: followingMap,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ success: false, message: errorMessage });
    }
}

// ============================================
// GET CURRENT USER (ME) — requires auth
// ============================================
async function getCurrentUserController(req: AuthRequest, res: Response): Promise<void> {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }

        const user = await User.findById(userId).select("-password -resetPasswordToken -resetPasswordExpires");
        if (!user) {
            res.status(404).json({ success: false, message: "User not found" });
            return;
        }

        res.status(200).json({
            success: true,
            data: {
                id: user._id,
                fullname: user.fullname,
                username: user.username,
                email: user.email,
                role: user.role,
                profileImage: user.profileImage,
                headline: user.headline,
                about: user.about,
                website: user.website,
                socialLinks: user.socialLinks,
                followers: user.followers?.length || 0,
                following: user.following?.length || 0,
                createdAt: user.createdAt,
            },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ success: false, message: errorMessage });
    }
}

// ============================================
// UPDATE PROFILE — PUT /api/authentication/update-profile
// ============================================
async function updateProfileController(req: AuthRequest, res: Response): Promise<void> {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }

        const { fullname, username, headline, about, website, socialLinks } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({ success: false, message: "User not found" });
            return;
        }

        // Validate username uniqueness if changed
        if (username && username !== user.username) {
            const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
            if (!usernameRegex.test(username)) {
                res.status(400).json({
                    success: false,
                    message: "Username must be 3-30 characters, only letters, numbers, and underscores",
                });
                return;
            }
            const existingUser = await User.findOne({ username, _id: { $ne: userId } });
            if (existingUser) {
                res.status(400).json({ success: false, message: "Username already taken" });
                return;
            }
            user.username = username;
        }

        if (fullname !== undefined) user.fullname = fullname.trim();
        if (headline !== undefined) user.headline = headline.trim();
        if (about !== undefined) user.about = about.trim();
        if (website !== undefined) user.website = website.trim();
        if (socialLinks !== undefined) {
            user.socialLinks = Array.isArray(socialLinks)
                ? socialLinks.filter((link: string) => link.trim())
                : [];
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            data: {
                id: user._id,
                fullname: user.fullname,
                username: user.username,
                email: user.email,
                role: user.role,
                profileImage: user.profileImage,
                headline: user.headline,
                about: user.about,
                website: user.website,
                socialLinks: user.socialLinks,
            },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ success: false, message: errorMessage });
    }
}

// ============================================
// UPDATE AVATAR — PUT /api/authentication/update-avatar
// ============================================
async function updateAvatarController(req: AuthRequest, res: Response): Promise<void> {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }

        const file = req.file;
        if (!file) {
            res.status(400).json({ success: false, message: "No image file provided" });
            return;
        }

        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({ success: false, message: "User not found" });
            return;
        }

        // Create file URL from the uploaded file path
        const { createFileUrlFromPath } = await import("../utils/fileUploadHelper.js");
        user.profileImage = createFileUrlFromPath(file.path);
        await user.save();

        res.status(200).json({
            success: true,
            message: "Avatar updated successfully",
            data: {
                profileImage: user.profileImage,
            },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ success: false, message: errorMessage });
    }
}

// ============================================
// CHANGE PASSWORD — PUT /api/authentication/change-password
// ============================================
async function changePasswordController(req: AuthRequest, res: Response): Promise<void> {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }

        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            res.status(400).json({ success: false, message: "Current password and new password are required" });
            return;
        }

        if (newPassword.length < 6) {
            res.status(400).json({ success: false, message: "New password must be at least 6 characters" });
            return;
        }

        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({ success: false, message: "User not found" });
            return;
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            res.status(400).json({ success: false, message: "Current password is incorrect" });
            return;
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.status(200).json({
            success: true,
            message: "Password changed successfully",
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ success: false, message: errorMessage });
    }
}

// ============================================
// FORGOT PASSWORD — POST /api/authentication/forgot-password
// ============================================
async function forgotPasswordController(req: Request, res: Response): Promise<void> {
    try {
        const { email } = req.body;

        if (!email) {
            res.status(400).json({ success: false, message: "Email is required" });
            return;
        }

        const user = await User.findOne({ email });
        if (!user) {
            // Don't reveal whether user exists
            res.status(200).json({
                success: true,
                message: "If an account with that email exists, a password reset link has been sent",
            });
            return;
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString("hex");
        const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await user.save();

        // In production, send email with reset link
        // For now, return the token (in production, this would be sent via email)
        const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${resetToken}`;

        console.log(`Password reset URL for ${email}: ${resetUrl}`);

        res.status(200).json({
            success: true,
            message: "If an account with that email exists, a password reset link has been sent",
            // Remove resetToken in production — only for development/testing
            ...(process.env.NODE_ENV !== "production" && { resetToken, resetUrl }),
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ success: false, message: errorMessage });
    }
}

// ============================================
// RESET PASSWORD — POST /api/authentication/reset-password
// ============================================
async function resetPasswordController(req: Request, res: Response): Promise<void> {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            res.status(400).json({ success: false, message: "Token and new password are required" });
            return;
        }

        if (newPassword.length < 6) {
            res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
            return;
        }

        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: new Date() },
        });

        if (!user) {
            res.status(400).json({ success: false, message: "Invalid or expired reset token" });
            return;
        }

        user.password = await bcrypt.hash(newPassword, 10);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.status(200).json({
            success: true,
            message: "Password reset successful. You can now log in with your new password.",
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ success: false, message: errorMessage });
    }
}

export {
    registrationController,
    loginController,
    allUsersController,
    deleteUserController,
    markersController,
    followUserController,
    getFollowStatusController,
    getCurrentUserController,
    updateProfileController,
    updateAvatarController,
    changePasswordController,
    forgotPasswordController,
    resetPasswordController,
};