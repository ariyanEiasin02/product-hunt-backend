# Comment System API Documentation

## ✅ Successfully Implemented

### Features:

- ✅ Create comments on products
- ✅ Get all comments for a product
- ✅ Nested replies (comment on comments)
- ✅ Update own comments
- ✅ Delete own comments
- ✅ Get user's comment history
- ✅ Auto-increment/decrement product comment count
- ✅ User authentication required for write operations

---

## API Endpoints

### 1. Create Comment

**POST** `/api/products/:productId/comments`

**Headers:**

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Body:**

```json
{
  "content": "This is an amazing product! Love the features.",
  "parentComment": "optional_parent_comment_id_for_replies"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Comment created successfully",
  "data": {
    "_id": "comment_id",
    "product": "product_id",
    "user": {
      "_id": "user_id",
      "fullname": "John Doe",
      "email": "john@example.com"
    },
    "content": "This is an amazing product!",
    "parentComment": null,
    "isEdited": false,
    "createdAt": "2026-01-21T...",
    "updatedAt": "2026-01-21T..."
  }
}
```

---

### 2. Get Product Comments

**GET** `/api/products/:productId/comments?limit=50&page=1&parentOnly=true`

**Query Parameters:**

- `limit` (optional): Number of comments per page (default: 50)
- `page` (optional): Page number (default: 1)
- `parentOnly` (optional): If "true", only returns top-level comments (not replies)

**Response:**

```json
{
  "success": true,
  "message": "Comments retrieved successfully",
  "data": {
    "comments": [
      {
        "_id": "comment_id",
        "product": "product_id",
        "user": {
          "_id": "user_id",
          "fullname": "John Doe",
          "email": "john@example.com"
        },
        "content": "Great product!",
        "parentComment": null,
        "isEdited": false,
        "createdAt": "2026-01-21T..."
      }
    ],
    "pagination": {
      "total": 42,
      "page": 1,
      "limit": 50,
      "pages": 1
    }
  }
}
```

---

### 3. Get Comment Replies

**GET** `/api/comments/:commentId/replies`

**Response:**

```json
{
  "success": true,
  "message": "Replies retrieved successfully",
  "data": {
    "replies": [
      {
        "_id": "reply_id",
        "content": "I agree!",
        "user": {
          "fullname": "Jane Smith"
        },
        "createdAt": "2026-01-21T..."
      }
    ],
    "count": 3
  }
}
```

---

### 4. Update Comment

**PUT** `/api/comments/:commentId`

**Headers:**

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Body:**

```json
{
  "content": "Updated comment content"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Comment updated successfully",
  "data": {
    "_id": "comment_id",
    "content": "Updated comment content",
    "isEdited": true,
    "editedAt": "2026-01-21T...",
    "user": { ... }
  }
}
```

---

### 5. Delete Comment

**DELETE** `/api/comments/:commentId`

**Headers:**

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**

```json
{
  "success": true,
  "message": "Comment deleted successfully"
}
```

**Note:** Deleting a comment also deletes all its replies.

---

### 6. Get User's Comments

**GET** `/api/users/:userId/comments?limit=20&page=1`

**Response:**

```json
{
  "success": true,
  "message": "User comments retrieved successfully",
  "data": {
    "comments": [
      {
        "_id": "comment_id",
        "content": "Great product!",
        "user": { ... },
        "product": {
          "_id": "product_id",
          "name": "Product Name",
          "slug": "product-name",
          "thumbnail": "https://..."
        },
        "createdAt": "2026-01-21T..."
      }
    ],
    "pagination": { ... }
  }
}
```

---

## Database Schema

### Comment Model

```typescript
{
  product: ObjectId (ref: Product) - required
  user: ObjectId (ref: User) - required
  content: String (1-2000 chars) - required
  parentComment: ObjectId (ref: Comment) - optional (for nested replies)
  isEdited: Boolean - default: false
  editedAt: Date - optional
  createdAt: Date - auto
  updatedAt: Date - auto
}
```

### Product Model (Updated)

```typescript
{
  // ... existing fields
  commentsCount: Number - default: 0
  // Auto-increments when comment created
  // Auto-decrements when comment deleted
}
```

---

## Features

### 1. Nested Comments

- Comments can have replies (parentComment field)
- Get all replies to a specific comment
- Deleting a comment deletes all its replies

### 2. Comment Count Tracking

- Product's `commentsCount` automatically updates
- Increments on comment creation
- Decrements on comment deletion (includes replies)

### 3. Authentication & Authorization

- User must be authenticated to create, update, or delete comments
- Users can only edit/delete their own comments
- Anyone can read comments (no auth required)

### 4. Validation

- Content required (1-2000 characters)
- Product must exist
- Parent comment must exist (if replying)
- User authentication checked

### 5. Pagination

- Configurable limit per page
- Page-based navigation
- Total count and pages included in response

---

## Testing Examples

### Create a Comment

```bash
curl -X POST http://localhost:3000/api/products/PRODUCT_ID/comments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "This product is amazing! Great work!"
  }'
```

### Reply to a Comment

```bash
curl -X POST http://localhost:3000/api/products/PRODUCT_ID/comments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "I totally agree with you!",
    "parentComment": "PARENT_COMMENT_ID"
  }'
```

### Get Product Comments

```bash
curl http://localhost:3000/api/products/PRODUCT_ID/comments?limit=10&parentOnly=true
```

### Update Comment

```bash
curl -X PUT http://localhost:3000/api/comments/COMMENT_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Updated content here"
  }'
```

### Delete Comment

```bash
curl -X DELETE http://localhost:3000/api/comments/COMMENT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description here"
}
```

### Common Errors:

- `401`: User not authenticated
- `403`: Forbidden (trying to edit/delete someone else's comment)
- `404`: Product/Comment not found
- `400`: Validation error (empty content, too long, etc.)
- `500`: Server error

---

## Professional Features Included:

✅ Proper TypeScript interfaces
✅ Input validation
✅ Error handling
✅ Authentication & authorization
✅ Pagination support
✅ Nested comments (replies)
✅ Auto-update comment counts
✅ Populated user & product data
✅ Indexes for performance
✅ Edit tracking (isEdited, editedAt)
✅ Cascade delete (deleting comment deletes replies)
✅ User ownership verification
✅ RESTful API design

---

🎉 **Comment system is fully functional and production-ready!**
