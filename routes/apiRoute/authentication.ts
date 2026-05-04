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
  changePasswordController,
  forgotPasswordController,
  resetPasswordController,
} from "../../controllers/registrationController.js";
import { isAdmin, verifyToken, isAdminOrSelf } from "../../middleware/authMiddleware.js";
import { uploadAvatar } from "../../config/multer.js";

const router = Router();

// Auth
router.post("/register", registrationController);
router.post("/login", loginController);

// Current user
router.get("/me", verifyToken, getCurrentUserController);

// Profile management
router.put("/update-profile", verifyToken, updateProfileController);
router.put("/update-avatar", verifyToken, uploadAvatar.single("profileImage"), updateAvatarController);

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