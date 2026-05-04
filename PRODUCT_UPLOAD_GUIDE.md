# Product Creation with File Upload

## Fixed Issues

### ✅ Node.js/TypeScript Error Fixed

- **Problem**: Deprecation warnings and import errors with `ts-node`
- **Solution**:
  - Replaced `ts-node` with `tsx` (faster, more reliable)
  - Created proper `tsconfig.json`
  - Updated dev script to use `tsx watch`

### ✅ Product Creation with Multer

- **Added**: File upload support for product thumbnails and gallery
- **Updated**: Product controller to handle both file uploads and URL inputs
- **Updated**: Product routes with multer middleware

---

## Product Creation Endpoint

**POST** `/api/products`

Create a new product with optional file uploads for thumbnail and gallery images.

### Content-Type

`multipart/form-data` (when uploading files)  
OR  
`application/json` (when using URLs)

---

## Request Options

### Option 1: Upload Files (Recommended)

Use `multipart/form-data` with the following fields:

#### Form Fields

- `name` (required): Product name (max 40 chars)
- `tagline` (required): Product tagline (max 60 chars)
- `description` (required): Full product description
- `links` (required): JSON string of links object
- `makers` (required): Array of maker user IDs
- `topics` (required): Array of topic IDs (1-3)
- `thumbnail` (file): Thumbnail image file
- `gallery` (files): Gallery image files (max 10)
- `firstComment` (optional): Maker's first comment
- `pricingType` (optional): "free", "paid", "freemium", "paid_with_free_trial"
- `isOpenSource` (optional): Boolean
- `isAiProduct` (optional): Boolean
- `scheduledLaunchDate` (optional): ISO date string

#### Example with JavaScript Fetch

```javascript
const formData = new FormData();

// Required text fields
formData.append("name", "My Awesome Product");
formData.append("tagline", "The best product ever");
formData.append("description", "This product will change your life...");

// Links (as JSON string)
formData.append(
  "links",
  JSON.stringify({
    website: "https://myproduct.com",
    appStore: "https://apps.apple.com/...",
    playStore: "https://play.google.com/...",
    demo: "https://demo.myproduct.com",
    video: "https://youtube.com/...",
    github: "https://github.com/...",
  }),
);

// Arrays
formData.append("makers", JSON.stringify(["maker_id_1", "maker_id_2"]));
formData.append("topics", JSON.stringify(["topic_id_1", "topic_id_2"]));

// File uploads
formData.append("thumbnail", thumbnailFile); // File object
galleryFiles.forEach((file) => {
  formData.append("gallery", file); // Multiple files
});

// Optional fields
formData.append("pricingType", "freemium");
formData.append("isOpenSource", "true");
formData.append("isAiProduct", "true");

// Send request
const response = await fetch("/api/products", {
  method: "POST",
  body: formData,
  // Note: Don't set Content-Type header, browser will set it automatically
});

const result = await response.json();
console.log(result);
```

#### Example with Postman

1. Method: POST
2. URL: `http://localhost:5000/api/products`
3. Body: form-data
4. Add fields:
   - `name`: My Awesome Product
   - `tagline`: The best product ever
   - `description`: This product will...
   - `links`: `{"website":"https://example.com"}`
   - `makers`: `["user_id_1"]`
   - `topics`: `["topic_id_1"]`
   - `thumbnail`: [File] Select image
   - `gallery`: [File] Select multiple images
   - `pricingType`: freemium
   - `isOpenSource`: true
   - `isAiProduct`: true

---

### Option 2: Use URLs (Without File Upload)

Use `application/json` with URLs for images:

```json
{
  "name": "My Awesome Product",
  "tagline": "The best product ever",
  "description": "This product will change your life...",
  "links": {
    "website": "https://myproduct.com",
    "appStore": "https://apps.apple.com/...",
    "playStore": "https://play.google.com/...",
    "demo": "https://demo.myproduct.com",
    "video": "https://youtube.com/...",
    "github": "https://github.com/..."
  },
  "thumbnail": "https://example.com/thumbnail.jpg",
  "gallery": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg"
  ],
  "makers": ["user_id_1", "user_id_2"],
  "topics": ["topic_id_1", "topic_id_2"],
  "pricingType": "freemium",
  "isOpenSource": true,
  "isAiProduct": true,
  "firstComment": "Excited to launch this!",
  "scheduledLaunchDate": "2026-02-01T10:00:00.000Z"
}
```

---

## Response

### Success Response (201 Created)

```json
{
  "success": true,
  "message": "Product submitted successfully",
  "data": {
    "_id": "product_id",
    "name": "My Awesome Product",
    "tagline": "The best product ever",
    "slug": "my-awesome-product",
    "description": "This product will...",
    "links": {
      "website": "https://myproduct.com",
      "appStore": "https://apps.apple.com/...",
      "playStore": "https://play.google.com/...",
      "demo": "https://demo.myproduct.com",
      "video": "https://youtube.com/...",
      "github": "https://github.com/..."
    },
    "thumbnail": "http://localhost:5000/uploads/products/thumbnail-1234567890-123.jpg",
    "gallery": [
      "http://localhost:5000/uploads/products/gallery-1234567890-456.jpg",
      "http://localhost:5000/uploads/products/gallery-1234567890-789.jpg"
    ],
    "makers": [
      {
        "_id": "user_id_1",
        "fullname": "John Doe",
        "email": "john@example.com"
      }
    ],
    "topics": [
      {
        "_id": "topic_id_1",
        "name": "Productivity",
        "slug": "productivity"
      }
    ],
    "pricingType": "freemium",
    "isOpenSource": true,
    "isAiProduct": true,
    "status": "pending",
    "upvotes": 0,
    "commentsCount": 0,
    "averageRating": 0,
    "totalReviews": 0,
    "createdAt": "2026-01-22T10:00:00.000Z",
    "updatedAt": "2026-01-22T10:00:00.000Z"
  }
}
```

### Error Responses

#### 400 Bad Request - Missing Fields

```json
{
  "success": false,
  "message": "Missing required fields: name, tagline, description, and website link are required"
}
```

#### 400 Bad Request - File Upload Error

```json
{
  "success": false,
  "message": "File size exceeds the maximum allowed limit"
}
```

#### 400 Bad Request - Duplicate Slug

```json
{
  "success": false,
  "message": "A product with this name/slug already exists"
}
```

---

## File Upload Specifications

### Thumbnail

- **Field name**: `thumbnail`
- **Max files**: 1
- **Max size**: 5MB per file
- **Allowed types**: JPEG, PNG, WebP, GIF
- **Stored in**: `uploads/products/`

### Gallery

- **Field name**: `gallery`
- **Max files**: 10
- **Max size**: 5MB per file
- **Allowed types**: JPEG, PNG, WebP, GIF
- **Stored in**: `uploads/products/`

---

## Features

### ✅ Flexible Input

- Supports both file uploads and URLs
- Mix file uploads with URL inputs
- Auto-generates URLs for uploaded files

### ✅ Validation

- File type validation
- File size limits
- Field validation
- Duplicate slug checking
- Topic and maker validation

### ✅ Auto-generated Fields

- Slug auto-generated from name
- Status set to "pending"
- Timestamps automatically added
- Default values for optional fields

---

## Frontend Integration Examples

### React/Next.js with File Upload

```typescript
import { useState } from 'react';

function CreateProductForm() {
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const formData = new FormData();

    // Add text fields
    formData.append('name', 'My Product');
    formData.append('tagline', 'Amazing product');
    formData.append('description', 'Full description...');
    formData.append('links', JSON.stringify({
      website: 'https://example.com'
    }));
    formData.append('makers', JSON.stringify(['maker_id']));
    formData.append('topics', JSON.stringify(['topic_id']));

    // Add files
    if (thumbnailFile) {
      formData.append('thumbnail', thumbnailFile);
    }

    galleryFiles.forEach(file => {
      formData.append('gallery', file);
    });

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        console.log('Product created:', result.data);
        // Handle success
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
      />

      <input
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => setGalleryFiles(Array.from(e.target.files || []))}
      />

      {/* Other form fields */}

      <button type="submit">Create Product</button>
    </form>
  );
}
```

---

## Server Status

✅ **Server Running**: http://localhost:5000  
✅ **Upload Directories**: Automatically created  
✅ **Static Files**: Served at `/uploads/*`  
✅ **Multer**: Configured and working

---

## Testing

### With cURL

```bash
curl -X POST http://localhost:5000/api/products \
  -F "name=Test Product" \
  -F "tagline=Amazing product" \
  -F "description=Full description here" \
  -F 'links={"website":"https://example.com"}' \
  -F 'makers=["maker_id"]' \
  -F 'topics=["topic_id"]' \
  -F "thumbnail=@/path/to/image.jpg" \
  -F "gallery=@/path/to/image1.jpg" \
  -F "gallery=@/path/to/image2.jpg"
```

### Uploaded Files Access

After upload, files are accessible at:

- `http://localhost:5000/uploads/products/filename.jpg`

---

## Notes

1. **Mixed Input**: You can upload thumbnail as file and provide gallery as URLs (or vice versa)
2. **Arrays in FormData**: When using form-data, arrays must be JSON stringified
3. **Links Object**: Must be a valid JSON string in form-data
4. **File Names**: Automatically sanitized and made unique with timestamps
5. **Authentication**: Currently not required for product creation (add if needed)

---

## Next Steps

- Add authentication middleware for product creation
- Implement image optimization (Sharp)
- Add image validation (dimensions, aspect ratio)
- Configure cloud storage (AWS S3, Cloudinary)
- Add product approval workflow
