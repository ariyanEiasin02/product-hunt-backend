# Review API Documentation

## Overview

This API provides comprehensive product review and rating functionality with professional features including:

- Star ratings (1-5)
- Detailed reviews with pros and cons
- Review statistics and analytics
- Helpful/unhelpful voting
- Verified purchase badges
- User-specific reviews

---

## Endpoints

### 1. Create Review

**POST** `/api/products/:productId/reviews`

Create a new review for a product. Users can only create one review per product.

#### Authentication

Required: Yes

#### Request Body

```json
{
  "rating": 5,
  "title": "Amazing product!",
  "content": "This product exceeded my expectations. Very easy to use and great value for money.",
  "pros": ["Easy to use", "Great value", "Excellent support"],
  "cons": ["Slight learning curve"],
  "isVerifiedPurchase": true
}
```

#### Parameters

- `rating` (required): Integer between 1-5
- `title` (required): String, max 100 characters
- `content` (required): String, 10-2000 characters
- `pros` (optional): Array of strings, max 5 items
- `cons` (optional): Array of strings, max 5 items
- `isVerifiedPurchase` (optional): Boolean, default false

#### Response

```json
{
  "success": true,
  "message": "Review created successfully",
  "data": {
    "_id": "review_id",
    "product": "product_id",
    "user": {
      "_id": "user_id",
      "fullname": "John Doe",
      "email": "john@example.com"
    },
    "rating": 5,
    "title": "Amazing product!",
    "content": "This product exceeded my expectations...",
    "pros": ["Easy to use", "Great value", "Excellent support"],
    "cons": ["Slight learning curve"],
    "isVerifiedPurchase": true,
    "helpfulCount": 0,
    "isEdited": false,
    "createdAt": "2026-01-22T10:00:00.000Z",
    "updatedAt": "2026-01-22T10:00:00.000Z"
  }
}
```

---

### 2. Get Product Reviews

**GET** `/api/products/:productId/reviews`

Get all reviews for a product with pagination, filtering, and statistics.

#### Authentication

Not required

#### Query Parameters

- `page` (optional): Page number, default 1
- `limit` (optional): Items per page, default 20
- `sortBy` (optional): Sort order
  - `helpful` (default): Most helpful first
  - `recent`: Most recent first
  - `rating_high`: Highest rating first
  - `rating_low`: Lowest rating first
- `rating` (optional): Filter by specific rating (1-5)

#### Example Request

```
GET /api/products/prod123/reviews?page=1&limit=10&sortBy=helpful&rating=5
```

#### Response

```json
{
  "success": true,
  "message": "Reviews retrieved successfully",
  "data": {
    "reviews": [
      {
        "_id": "review_id",
        "product": "product_id",
        "user": {
          "_id": "user_id",
          "fullname": "John Doe"
        },
        "rating": 5,
        "title": "Amazing product!",
        "content": "This product exceeded my expectations...",
        "pros": ["Easy to use"],
        "cons": [],
        "isVerifiedPurchase": true,
        "helpfulCount": 15,
        "isEdited": false,
        "createdAt": "2026-01-22T10:00:00.000Z"
      }
    ],
    "statistics": {
      "averageRating": 4.5,
      "totalReviews": 127,
      "ratingDistribution": {
        "5": 80,
        "4": 30,
        "3": 10,
        "2": 5,
        "1": 2
      }
    },
    "pagination": {
      "total": 127,
      "page": 1,
      "limit": 10,
      "pages": 13
    }
  }
}
```

---

### 3. Get Review Statistics

**GET** `/api/products/:productId/reviews/statistics`

Get detailed statistics for a product's reviews including rating distribution and percentages.

#### Authentication

Not required

#### Response

```json
{
  "success": true,
  "message": "Review statistics retrieved successfully",
  "data": {
    "averageRating": 4.5,
    "totalReviews": 127,
    "verifiedPurchases": 85,
    "ratingDistribution": {
      "5": {
        "count": 80,
        "percentage": 63
      },
      "4": {
        "count": 30,
        "percentage": 24
      },
      "3": {
        "count": 10,
        "percentage": 8
      },
      "2": {
        "count": 5,
        "percentage": 4
      },
      "1": {
        "count": 2,
        "percentage": 1
      }
    }
  }
}
```

---

### 4. Get Single Review

**GET** `/api/reviews/:reviewId`

Get details of a specific review.

#### Authentication

Not required

#### Response

```json
{
  "success": true,
  "message": "Review retrieved successfully",
  "data": {
    "_id": "review_id",
    "product": {
      "_id": "product_id",
      "name": "Product Name",
      "slug": "product-name",
      "thumbnail": "https://..."
    },
    "user": {
      "_id": "user_id",
      "fullname": "John Doe",
      "email": "john@example.com"
    },
    "rating": 5,
    "title": "Amazing product!",
    "content": "This product exceeded my expectations...",
    "pros": ["Easy to use"],
    "cons": [],
    "isVerifiedPurchase": true,
    "helpfulCount": 15,
    "isEdited": false,
    "createdAt": "2026-01-22T10:00:00.000Z",
    "updatedAt": "2026-01-22T10:00:00.000Z"
  }
}
```

---

### 5. Update Review

**PUT** `/api/reviews/:reviewId`

Update an existing review. Users can only edit their own reviews.

#### Authentication

Required: Yes

#### Request Body

```json
{
  "rating": 4,
  "title": "Updated: Still great!",
  "content": "After using it for a month, I'm updating my review...",
  "pros": ["Easy to use", "Great support"],
  "cons": ["Could use more features"]
}
```

#### Response

```json
{
  "success": true,
  "message": "Review updated successfully",
  "data": {
    "_id": "review_id",
    "rating": 4,
    "title": "Updated: Still great!",
    "content": "After using it for a month...",
    "isEdited": true,
    "editedAt": "2026-01-22T15:30:00.000Z",
    ...
  }
}
```

---

### 6. Delete Review

**DELETE** `/api/reviews/:reviewId`

Delete a review. Users can only delete their own reviews.

#### Authentication

Required: Yes

#### Response

```json
{
  "success": true,
  "message": "Review deleted successfully"
}
```

---

### 7. Mark Review as Helpful

**POST** `/api/reviews/:reviewId/helpful`

Toggle the "helpful" status for a review. Users can mark/unmark reviews as helpful.

#### Authentication

Required: Yes

#### Response

```json
{
  "success": true,
  "message": "Review marked as helpful successfully",
  "data": {
    "review": {
      "_id": "review_id",
      "helpfulCount": 16,
      ...
    },
    "isHelpful": true
  }
}
```

---

### 8. Get User Reviews

**GET** `/api/users/:userId/reviews`

Get all reviews written by a specific user.

#### Authentication

Not required

#### Query Parameters

- `page` (optional): Page number, default 1
- `limit` (optional): Items per page, default 20

#### Response

```json
{
  "success": true,
  "message": "User reviews retrieved successfully",
  "data": {
    "reviews": [
      {
        "_id": "review_id",
        "product": {
          "_id": "product_id",
          "name": "Product Name",
          "slug": "product-name",
          "thumbnail": "https://..."
        },
        "rating": 5,
        "title": "Amazing product!",
        "content": "This product exceeded my expectations...",
        "createdAt": "2026-01-22T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 15,
      "page": 1,
      "limit": 20,
      "pages": 1
    }
  }
}
```

---

## Error Responses

### 400 Bad Request

```json
{
  "success": false,
  "message": "Rating must be between 1 and 5"
}
```

### 401 Unauthorized

```json
{
  "success": false,
  "message": "User not authenticated"
}
```

### 403 Forbidden

```json
{
  "success": false,
  "message": "You can only edit your own reviews"
}
```

### 404 Not Found

```json
{
  "success": false,
  "message": "Review not found"
}
```

### 409 Conflict

```json
{
  "success": false,
  "message": "You have already reviewed this product. Please edit your existing review."
}
```

### 500 Server Error

```json
{
  "success": false,
  "message": "Server error"
}
```

---

## Features

### ✅ Professional Rating System

- 5-star rating scale
- Rating statistics and distribution
- Average rating calculation
- Percentage breakdown by rating

### ✅ Detailed Reviews

- Review title and content
- Pros and cons lists
- Verified purchase badges
- Edit history tracking

### ✅ Social Features

- Helpful/unhelpful voting
- Sort by helpfulness
- User review history

### ✅ Quality Controls

- One review per user per product
- Content length validation
- Rating range validation
- Authentication required for actions

### ✅ Advanced Filtering

- Filter by rating
- Sort by helpful, recent, rating
- Pagination support

---

## Database Schema

### Review Model

```typescript
{
  product: ObjectId (ref: Product),
  user: ObjectId (ref: User),
  rating: Number (1-5),
  title: String (max 100),
  content: String (10-2000),
  pros: [String] (max 5),
  cons: [String] (max 5),
  isVerifiedPurchase: Boolean,
  helpfulCount: Number,
  helpfulBy: [ObjectId],
  isEdited: Boolean,
  editedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes

- Compound unique index: `{ product, user }`
- Performance indexes on: `product`, `rating`, `helpfulCount`

---

## Usage Examples

### Frontend Integration

#### Display Product Rating Summary

```javascript
// Fetch statistics
const stats = await fetch("/api/products/prod123/reviews/statistics");
const data = await stats.json();

// Display: ⭐ 4.5 (127 reviews)
console.log(
  `⭐ ${data.data.averageRating} (${data.data.totalReviews} reviews)`,
);
```

#### Create a Review

```javascript
const response = await fetch("/api/products/prod123/reviews", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    rating: 5,
    title: "Excellent product",
    content: "I really enjoyed using this product...",
    pros: ["Easy to use", "Great value"],
    cons: ["Minor bugs"],
  }),
});
```

#### Load Reviews with Pagination

```javascript
const reviews = await fetch(
  "/api/products/prod123/reviews?page=1&limit=10&sortBy=helpful",
);
const data = await reviews.json();

// Display reviews
data.data.reviews.forEach((review) => {
  console.log(`${review.rating}⭐ - ${review.title}`);
  console.log(`Helpful: ${review.helpfulCount}`);
});
```

---

## Notes

1. **One Review Per Product**: Each user can only submit one review per product. To change their review, they must edit the existing one.

2. **Soft Delete**: Reviews are hard-deleted from the database when deleted.

3. **Real-time Statistics**: Review statistics are calculated dynamically using MongoDB aggregation.

4. **Performance**: Indexes are optimized for common queries (by product, by rating, by helpfulness).

5. **Validation**: All inputs are validated on the server side with appropriate error messages.
