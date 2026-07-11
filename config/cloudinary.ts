import { v2 as cloudinary } from "cloudinary";

/**
 * Initialize Cloudinary with credentials from environment variables.
 * Must be called AFTER dotenv.config() has loaded the .env file.
 */
export function initCloudinary(): void {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.error(
      "[Cloudinary] Missing required environment variables:",
      { cloudName: !!cloudName, apiKey: !!apiKey, apiSecret: !!apiSecret }
    );
    console.error(
      "[Cloudinary] Ensure .env file has CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET set"
    );
  } else {
    console.log("[Cloudinary] Initialized with cloud name:", cloudName);
  }

  cloudinary.config({
    cloud_name: cloudName!,
    api_key: apiKey!,
    api_secret: apiSecret!,
  });
}

export default cloudinary;