const express = require("express")
const { body, param, query } = require("express-validator")
const { prisma } = require("../config/database")
const { successResponse, errorResponse } = require("../utils/response")
const { handleValidationErrors } = require("../middleware/validation")
const { authenticateToken } = require("../middleware/auth")

const router = express.Router()

// All review routes require authentication
router.use(authenticateToken)

// Validation rules
const createReviewValidation = [
  body("transactionId").notEmpty().withMessage("Transaction ID is required"),
  body("restaurantId").isInt({ min: 1 }).withMessage("Restaurant ID must be a positive integer"),
  body("star").isInt({ min: 1, max: 5 }).withMessage("Rating must be between 1 and 5 stars"),
  body("comment").optional().isString().isLength({ max: 500 }).withMessage("Comment must be less than 500 characters"),
]

const getReviewsValidation = [
  param("restaurantId").isInt({ min: 1 }).withMessage("Restaurant ID must be a positive integer"),
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 50 }).withMessage("Limit must be between 1 and 50"),
  query("rating").optional().isInt({ min: 1, max: 5 }).withMessage("Rating filter must be between 1 and 5"),
]

// Helper function to update restaurant average rating
const updateRestaurantRating = async (restaurantId) => {
  try {
    // Calculate average rating from all reviews
    const reviews = await prisma.restoReview.findMany({
      where: { restaurantId },
      select: { star: true },
    })

    if (reviews.length > 0) {
      const averageRating = reviews.reduce((sum, review) => sum + review.star, 0) / reviews.length

      // Update restaurant rating
      await prisma.restaurant.update({
        where: { id: restaurantId },
        data: { star: Math.round(averageRating * 10) / 10 }, // Round to 1 decimal place
      })
    }
  } catch (error) {
    console.error("Error updating restaurant rating:", error)
  }
}

/**
 * @swagger
 * /api/review:
 *   post:
 *     summary: Create a new review for a restaurant
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transactionId
 *               - restaurantId
 *               - star
 *             properties:
 *               transactionId:
 *                 type: string
 *                 description: Transaction ID from completed order
 *                 example: "TXN17251234561"
 *               restaurantId:
 *                 type: integer
 *                 description: ID of the restaurant to review
 *                 example: 1
 *               star:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Rating from 1 to 5 stars
 *                 example: 5
 *               comment:
 *                 type: string
 *                 maxLength: 500
 *                 description: Optional review comment
 *                 example: "Great food and excellent service!"
 *     responses:
 *       201:
 *         description: Review created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Review created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     review:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         star:
 *                           type: integer
 *                         comment:
 *                           type: string
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                         user:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                             name:
 *                               type: string
 *                         restaurant:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                             name:
 *                               type: string
 *       400:
 *         description: Invalid input data or user can only review restaurants they ordered from
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Transaction or restaurant not found
 *       409:
 *         description: User has already reviewed this restaurant
 *       500:
 *         description: Internal server error
 */
// POST /review - Create a new review
router.post("/", createReviewValidation, handleValidationErrors, async (req, res) => {
  try {
    const userId = req.user.id
    const { transactionId, restaurantId, star, comment } = req.body

    // Verify transaction exists and belongs to the user
    const transaction = await prisma.transaction.findFirst({
      where: {
        transactionId,
        userId,
      },
    })

    if (!transaction) {
      return errorResponse(res, "Transaction not found or does not belong to you", 404)
    }

    // Verify restaurant exists
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    })

    if (!restaurant) {
      return errorResponse(res, "Restaurant not found", 404)
    }

    // Check if user has ordered from this restaurant in this transaction
    const hasOrderedFromRestaurant = transaction.items.some((item) => item.restaurantId === restaurantId)

    if (!hasOrderedFromRestaurant) {
      return errorResponse(res, "You can only review restaurants you have ordered from", 400)
    }

    // Check if user has already reviewed this restaurant for this transaction
    const existingReview = await prisma.restoReview.findFirst({
      where: {
        userId,
        restaurantId,
        // We can add transactionId to the schema later for more precise tracking
      },
    })

    if (existingReview) {
      return errorResponse(res, "You have already reviewed this restaurant", 409)
    }

    // Create review
    const review = await prisma.restoReview.create({
      data: {
        userId,
        restaurantId,
        star,
        comment: comment || null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        restaurant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Update restaurant average rating
    await updateRestaurantRating(restaurantId)

    return successResponse(
      res,
      {
        review: {
          id: review.id,
          star: review.star,
          comment: review.comment,
          createdAt: review.createdAt,
          user: review.user,
          restaurant: review.restaurant,
        },
      },
      "Review created successfully",
      201,
    )
  } catch (error) {
    console.error("Create review error:", error)
    return errorResponse(res, "Failed to create review")
  }
})

/**
 * @swagger
 * /api/review/restaurant/{restaurantId}:
 *   get:
 *     summary: Get reviews for a specific restaurant
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Restaurant ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Number of reviews per page
 *       - in: query
 *         name: rating
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *         description: Filter reviews by specific rating
 *     responses:
 *       200:
 *         description: Restaurant reviews retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     restaurant:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         name:
 *                           type: string
 *                         star:
 *                           type: number
 *                     reviews:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           star:
 *                             type: integer
 *                           comment:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           user:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                               name:
 *                                 type: string
 *                     statistics:
 *                       type: object
 *                       properties:
 *                         totalReviews:
 *                           type: integer
 *                         averageRating:
 *                           type: number
 *                         ratingDistribution:
 *                           type: object
 *                           properties:
 *                             "1":
 *                               type: integer
 *                             "2":
 *                               type: integer
 *                             "3":
 *                               type: integer
 *                             "4":
 *                               type: integer
 *                             "5":
 *                               type: integer
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *       400:
 *         description: Invalid query parameters
 *       404:
 *         description: Restaurant not found
 *       500:
 *         description: Internal server error
 */
// GET /review/restaurant/:restaurantId - Get reviews for a specific restaurant
router.get("/restaurant/:restaurantId", getReviewsValidation, handleValidationErrors, async (req, res) => {
  try {
    const { restaurantId } = req.params
    const { page = 1, limit = 10, rating } = req.query

    // Build where clause
    const whereClause = { restaurantId: Number.parseInt(restaurantId) }
    if (rating) {
      whereClause.star = Number.parseInt(rating)
    }

    // Get total count for pagination
    const totalReviews = await prisma.restoReview.count({
      where: whereClause,
    })

    // Get reviews with pagination
    const reviews = await prisma.restoReview.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (Number.parseInt(page) - 1) * Number.parseInt(limit),
      take: Number.parseInt(limit),
    })

    // Get restaurant info
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: Number.parseInt(restaurantId) },
      select: {
        id: true,
        name: true,
        star: true,
      },
    })

    if (!restaurant) {
      return errorResponse(res, "Restaurant not found", 404)
    }

    // Calculate rating distribution
    const ratingDistribution = await prisma.restoReview.groupBy({
      by: ["star"],
      where: { restaurantId: Number.parseInt(restaurantId) },
      _count: {
        star: true,
      },
    })

    const ratingStats = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    }

    ratingDistribution.forEach((rating) => {
      ratingStats[rating.star] = rating._count.star
    })

    return successResponse(res, {
      restaurant,
      reviews: reviews.map((review) => ({
        id: review.id,
        star: review.star,
        comment: review.comment,
        createdAt: review.createdAt,
        user: review.user,
      })),
      statistics: {
        totalReviews,
        averageRating: restaurant.star,
        ratingDistribution: ratingStats,
      },
      pagination: {
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        total: totalReviews,
        totalPages: Math.ceil(totalReviews / Number.parseInt(limit)),
      },
      filter: {
        rating: rating ? Number.parseInt(rating) : null,
      },
    })
  } catch (error) {
    console.error("Get restaurant reviews error:", error)
    return errorResponse(res, "Failed to get restaurant reviews")
  }
})

/**
 * @swagger
 * /api/review/my-reviews:
 *   get:
 *     summary: Get current user's reviews
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Number of reviews per page
 *     responses:
 *       200:
 *         description: User's reviews retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     reviews:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           star:
 *                             type: integer
 *                           comment:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           restaurant:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                               name:
 *                                 type: string
 *                               logo:
 *                                 type: string
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
// GET /review/my-reviews - Get current user's reviews
router.get("/my-reviews", async (req, res) => {
  try {
    const userId = req.user.id
    const { page = 1, limit = 10 } = req.query

    // Get total count for pagination
    const totalReviews = await prisma.restoReview.count({
      where: { userId },
    })

    // Get user's reviews
    const reviews = await prisma.restoReview.findMany({
      where: { userId },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (Number.parseInt(page) - 1) * Number.parseInt(limit),
      take: Number.parseInt(limit),
    })

    return successResponse(res, {
      reviews: reviews.map((review) => ({
        id: review.id,
        star: review.star,
        comment: review.comment,
        createdAt: review.createdAt,
        restaurant: review.restaurant,
      })),
      pagination: {
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        total: totalReviews,
        totalPages: Math.ceil(totalReviews / Number.parseInt(limit)),
      },
    })
  } catch (error) {
    console.error("Get my reviews error:", error)
    return errorResponse(res, "Failed to get your reviews")
  }
})

/**
 * @swagger
 * /api/review/{id}:
 *   put:
 *     summary: Update a review (user can only update their own review)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Review ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               star:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Updated rating from 1 to 5 stars
 *                 example: 4
 *               comment:
 *                 type: string
 *                 maxLength: 500
 *                 description: Updated review comment
 *                 example: "Updated review comment"
 *     responses:
 *       200:
 *         description: Review updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     review:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         star:
 *                           type: integer
 *                         comment:
 *                           type: string
 *                         updatedAt:
 *                           type: string
 *                           format: date-time
 *                         restaurant:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                             name:
 *                               type: string
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Review not found or does not belong to user
 *       500:
 *         description: Internal server error
 *   delete:
 *     summary: Delete a review (user can only delete their own review)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Review ID
 *     responses:
 *       200:
 *         description: Review deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Review deleted successfully"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Review not found or does not belong to user
 *       500:
 *         description: Internal server error
 */
// PUT /review/:id - Update a review (user can only update their own review)
router.put("/:id", async (req, res) => {
  try {
    const userId = req.user.id
    const { id } = req.params
    const { star, comment } = req.body

    // Validate star rating if provided
    if (star && (star < 1 || star > 5)) {
      return errorResponse(res, "Rating must be between 1 and 5 stars", 400)
    }

    // Find review and ensure it belongs to the user
    const review = await prisma.restoReview.findFirst({
      where: {
        id: Number.parseInt(id),
        userId,
      },
    })

    if (!review) {
      return errorResponse(res, "Review not found or does not belong to you", 404)
    }

    // Update review
    const updatedReview = await prisma.restoReview.update({
      where: { id: Number.parseInt(id) },
      data: {
        ...(star && { star }),
        ...(comment !== undefined && { comment }),
      },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Update restaurant average rating if star was changed
    if (star) {
      await updateRestaurantRating(review.restaurantId)
    }

    return successResponse(res, {
      review: {
        id: updatedReview.id,
        star: updatedReview.star,
        comment: updatedReview.comment,
        updatedAt: updatedReview.updatedAt,
        restaurant: updatedReview.restaurant,
      },
    })
  } catch (error) {
    console.error("Update review error:", error)
    return errorResponse(res, "Failed to update review")
  }
})

// DELETE /review/:id - Delete a review (user can only delete their own review)
router.delete("/:id", async (req, res) => {
  try {
    const userId = req.user.id
    const { id } = req.params

    // Find review and ensure it belongs to the user
    const review = await prisma.restoReview.findFirst({
      where: {
        id: Number.parseInt(id),
        userId,
      },
    })

    if (!review) {
      return errorResponse(res, "Review not found or does not belong to you", 404)
    }

    // Delete review
    await prisma.restoReview.delete({
      where: { id: Number.parseInt(id) },
    })

    // Update restaurant average rating
    await updateRestaurantRating(review.restaurantId)

    return successResponse(res, null, "Review deleted successfully")
  } catch (error) {
    console.error("Delete review error:", error)
    return errorResponse(res, "Failed to delete review")
  }
})

module.exports = router
