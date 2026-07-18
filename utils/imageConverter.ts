import sharp from "sharp";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Supported input MIME types that can be converted to WebP */
export const CONVERTIBLE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/tiff",
  "image/avif",
] as const;

export type ConvertibleMimeType = (typeof CONVERTIBLE_MIME_TYPES)[number];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WebpConversionOptions {
  /**
   * WebP quality (1–100). Default: 80.
   * 80 provides excellent visual quality with ~60–80 % file size reduction.
   */
  quality?: number;

  /**
   * Whether to preserve alpha transparency (for PNG/GIF sources). Default: true.
   */
  preserveTransparency?: boolean;

  /**
   * Maximum width in pixels. If set, the image will be resized proportionally.
   * Useful for thumbnails (e.g. 800 for product thumbnails).
   */
  maxWidth?: number;

  /**
   * Maximum height in pixels. If set, the image will be resized proportionally.
   */
  maxHeight?: number;

  /**
   * Whether to keep EXIF / metadata. Default: false (stripped for privacy and size).
   */
  keepMetadata?: boolean;
}

// ---------------------------------------------------------------------------
// Image → WebP conversion
// ---------------------------------------------------------------------------

/**
 * Convert an image buffer to WebP format using Sharp.
 *
 * Handles all common input formats (JPEG, PNG, WebP, GIF, TIFF, AVIF).
 * Strips metadata by default for smaller file sizes.
 * Preserves alpha transparency for PNG / GIF sources by default.
 *
 * @param inputBuffer - Raw image bytes (from multer memory storage).
 * @param options     - Conversion options (quality, sizing, transparency…).
 * @returns A Buffer containing the converted WebP image data.
 *
 * @throws If Sharp cannot decode the input (unsupported / corrupted image).
 *
 * @example
 * const webpBuffer = await convertToWebp(req.file.buffer, { quality: 85 });
 * // → webpBuffer is ready for Cloudinary upload
 */
export async function convertToWebp(
  inputBuffer: Buffer,
  options: WebpConversionOptions = {}
): Promise<Buffer> {
  const {
    quality = 80,
    preserveTransparency = true,
    maxWidth,
    maxHeight,
    keepMetadata = false,
  } = options;

  // Start a Sharp pipeline from the input buffer
  let pipeline = sharp(inputBuffer);

  // Resize if max dimensions are provided (maintains aspect ratio)
  if (maxWidth || maxHeight) {
    pipeline = pipeline.resize({
      width: maxWidth,
      height: maxHeight,
      fit: "inside", // Scale down to fit within the box, preserving ratio
      withoutEnlargement: true, // Don't upscale small images
    });
  }

  // Strip metadata (EXIF, ICC, etc.) by default for privacy & smaller files
  // Sharp strips metadata automatically — only call withMetadata() to KEEP it.
  if (keepMetadata) {
    pipeline = pipeline.withMetadata();
  }

  // Convert to WebP
  pipeline = pipeline.toFormat("webp", {
    quality,
    alphaQuality: preserveTransparency ? quality : 100,
    // lossless: false (default — good balance for photographic content)
    // nearLossless: false (default)
    // smartSubsample: true  (default — good for complex images)
    // reductionEffort: 6    (default: 4 — higher = smaller file, slower encode)
  });

  return pipeline.toBuffer();
}

/**
 * Check whether a MIME type is convertible to WebP.
 *
 * @param mimeType - The MIME type string (e.g. "image/png").
 * @returns `true` if the type is supported.
 */
export function isConvertibleImage(mimeType: string): boolean {
  return CONVERTIBLE_MIME_TYPES.includes(mimeType as ConvertibleMimeType);
}

/**
 * Get a human-readable list of supported image formats.
 */
export function getSupportedFormats(): string {
  return CONVERTIBLE_MIME_TYPES.map((t) => t.replace("image/", "")).join(", ");
}

export default {
  convertToWebp,
  isConvertibleImage,
  getSupportedFormats,
  CONVERTIBLE_MIME_TYPES,
};
