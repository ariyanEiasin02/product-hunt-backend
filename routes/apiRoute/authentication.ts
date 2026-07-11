import { Router } from "express";
import {
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
  updateAvatarCloudinaryController,
  changePasswordController,
  forgotPasswordController,
  resetPasswordController,
} from "../../controllers/registrationController.js";
import { isAdmin, verifyToken, isAdminOrSelf } from "../../middleware/authMiddleware.js";
import { uploadImageMemory } from "../../config/multer.js";
import { handleMulterError } from "../../middleware/uploadMiddleware.js";

const router = Router();

// Auth
router.post("/register", registrationController);
router.post("/login", loginController);

// Current user
router.get("/me", verifyToken, getCurrentUserController);

// Profile management — both endpoints now use memory storage for Cloudinary uploads
router.put("/update-profile", verifyToken, uploadImageMemory.single("profileImage"), handleMulterError, updateProfileController);
router.put("/update-avatar", verifyToken, uploadImageMemory.single("profileImage"), handleMulterError, updateAvatarController);

// Cloudinary avatar update (uses memory storage)
router.put("/update-avatar/cloudinary", verifyToken, uploadImageMemory.single("profileImage"), handleMulterError, updateAvatarCloudinaryController);

// Password management
router.put("/change-password", verifyToken, changePasswordController);
router.post("/forgot-password", forgotPasswordController);
router.post("/reset-password", resetPasswordController);

// Users
router.get("/allUsers", allUsersController);
router.get("/markers", markersController);
router.post("/follow/:userId", verifyToken, followUserController);
router.get("/followStatus", verifyToken, getFollowStatusController);
router.delete("/deleteUser/:id", verifyToken, isAdminOrSelf, deleteUserController);
export default router;