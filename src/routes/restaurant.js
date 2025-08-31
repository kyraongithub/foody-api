const express = require("express")
const { query, param } = require("express-validator")
const { prisma } = require("../config/database")
const { successResponse, errorResponse } = require("../utils/response")
const { handleValidationErrors } = require("../middleware/validation")
const { authenticateToken } = require("../middleware/auth")

const router = express.Router()

// Validation rules
const restaurantListValidation = [
  query("location").optional().trim().isLength({ min: 1 }).withMessage("Location cannot be empty"),
  query("range").optional().isFloat({ min: 0 }).withMessage("Range must be a positive number"),
  query("priceMin").optional().isInt({ min: 0 }).withMessage("Price minimum must be a positive integer"),
  query("priceMax").optional().isInt({ min: 0 }).withMessage("Price maximum must be a positive integer"),
  query("rating").optional().isFloat({ min: 0, max: 5 }).withMessage("Rating must be between 0 and 5"),
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 50 }).withMessage("Limit must be between 1 and 50"),
]

const restaurantDetailValidation = [
  param("id").isInt({ min: 1 }).withMessage("Restaurant ID must be a positive integer"),
  query("limitMenu").optional().isInt({ min: 1, max: 50 }).withMessage("Menu limit must be between 1 and 50"),
  query("limitReview").optional().isInt({ min: 1, max: 50 }).withMessage("Review limit must be between 1 and 50"),
]

// Helper function to calculate distance between two coordinates
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371 // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c // Distance in kilometers
  return distance
}

/**
 * @swagger
 * /api/resto:
 *   get:
 *     summary: Get restaurants with filters
 *     tags: [Restaurants]
 *     parameters:
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Location to search restaurants
 *       - in: query
 *         name: range
 *         schema:
 *           type: number
 *         description: Search range in kilometers
 *       - in: query
 *         name: priceMin
 *         schema:
 *           type: integer
 *         description: Minimum price filter
 *       - in: query
 *         name: priceMax
 *         schema:
 *           type: integer
 *         description: Maximum price filter
 *       - in: query
 *         name: rating
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 5
 *         description: Minimum rating filter
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
 *           default: 20
 *         description: Number of restaurants per page
 *     responses:
 *       200:
 *         description: List of restaurants retrieved successfully
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
 *                     restaurants:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           star:
 *                             type: number
 *                           place:
 *                             type: string
 *                           logo:
 *                             type: string
 *                           images:
 *                             type: array
 *                             items:
 *                               type: string
 *                           reviewCount:
 *                             type: integer
 *                           menuCount:
 *                             type: integer
 *                           priceRange:
 *                             type: object
 *                             properties:
 *                               min:
 *                                 type: integer
 *                               max:
 *                                 type: integer
 *                           distance:
 *                             type: number
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
 *       500:
 *         description: Internal server error
 */
// GET /resto - Get restaurants with filters
router.get("/", restaurantListValidation, handleValidationErrors, async (req, res) => {
  try {
    const { location, range, priceMin, priceMax, rating, page = 1, limit = 20 } = req.query

    // Build where clause for filtering
    const whereClause = {}

    // Filter by rating
    if (rating) {
      whereClause.star = {
        gte: Number.parseFloat(rating),
      }
    }

    // Get restaurants with menus for price filtering
    let restaurants = await prisma.restaurant.findMany({
      where: whereClause,
      include: {
        menus: {
          select: {
            id: true,
            foodName: true,
            price: true,
            type: true,
            image: true,
          },
        },
        reviews: {
          select: {
            star: true,
          },
        },
        _count: {
          select: {
            reviews: true,
          },
        },
      },
    })

    // Filter by price range if specified
    if (priceMin || priceMax) {
      restaurants = restaurants.filter((restaurant) => {
        const menuPrices = restaurant.menus.map((menu) => menu.price)
        if (menuPrices.length === 0) return false

        const minPrice = Math.min(...menuPrices)
        const maxPrice = Math.max(...menuPrices)

        let matchesPrice = true
        if (priceMin) matchesPrice = matchesPrice && maxPrice >= Number.parseInt(priceMin)
        if (priceMax) matchesPrice = matchesPrice && minPrice <= Number.parseInt(priceMax)

        return matchesPrice
      })
    }

    // Filter by location and range if specified
    if (location && range) {
      // For demo purposes, using Jakarta coordinates as reference
      // In real app, you would geocode the location parameter
      const referenceCoords = { lat: -6.2088, lng: 106.8456 }

      restaurants = restaurants.filter((restaurant) => {
        const distance = calculateDistance(referenceCoords.lat, referenceCoords.lng, restaurant.lat, restaurant.long)
        return distance <= Number.parseFloat(range)
      })
    }

    // Add distance and format response
    const formattedRestaurants = restaurants.map((restaurant) => {
      let distance = null
      if (location && range) {
        const referenceCoords = { lat: -6.2088, lng: 106.8456 }
        distance = calculateDistance(referenceCoords.lat, referenceCoords.lng, restaurant.lat, restaurant.long)
      }

      return {
        id: restaurant.id,
        name: restaurant.name,
        star: restaurant.star,
        place: restaurant.place,
        logo: restaurant.logo,
        images: restaurant.images,
        reviewCount: restaurant._count.reviews,
        menuCount: restaurant.menus.length,
        priceRange:
          restaurant.menus.length > 0
            ? {
                min: Math.min(...restaurant.menus.map((m) => m.price)),
                max: Math.max(...restaurant.menus.map((m) => m.price)),
              }
            : null,
        ...(distance !== null && { distance: Math.round(distance * 100) / 100 }),
      }
    })

    // Pagination
    const startIndex = (Number.parseInt(page) - 1) * Number.parseInt(limit)
    const endIndex = startIndex + Number.parseInt(limit)
    const paginatedRestaurants = formattedRestaurants.slice(startIndex, endIndex)

    return successResponse(res, {
      restaurants: paginatedRestaurants,
      pagination: {
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        total: formattedRestaurants.length,
        totalPages: Math.ceil(formattedRestaurants.length / Number.parseInt(limit)),
      },
      filters: {
        location,
        range: range ? Number.parseFloat(range) : null,
        priceMin: priceMin ? Number.parseInt(priceMin) : null,
        priceMax: priceMax ? Number.parseInt(priceMax) : null,
        rating: rating ? Number.parseFloat(rating) : null,
      },
    })
  } catch (error) {
    console.error("Get restaurants error:", error)
    return errorResponse(res, "Failed to get restaurants")
  }
})

/**
 * @swagger
 * /api/resto/recommended:
 *   get:
 *     summary: Get recommended restaurants for user
 *     tags: [Restaurants]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Recommended restaurants retrieved successfully
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
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           star:
 *                             type: number
 *                           place:
 *                             type: string
 *                           logo:
 *                             type: string
 *                           images:
 *                             type: array
 *                             items:
 *                               type: string
 *                           reviewCount:
 *                             type: integer
 *                           sampleMenus:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: integer
 *                                 foodName:
 *                                   type: string
 *                                 price:
 *                                   type: integer
 *                                 type:
 *                                   type: string
 *                                 image:
 *                                   type: string
 *                           isFrequentlyOrdered:
 *                             type: boolean
 *                     message:
 *                       type: string
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
// GET /resto/recommended - Get recommended restaurants
router.get("/recommended", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id

    // Get user's order history to understand preferences
    const userTransactions = await prisma.transaction.findMany({
      where: { userId },
      select: { items: true },
    })

    // Extract restaurant IDs from user's order history
    const orderedRestaurantIds = new Set()
    userTransactions.forEach((transaction) => {
      if (transaction.items && Array.isArray(transaction.items)) {
        transaction.items.forEach((item) => {
          if (item.restaurantId) {
            orderedRestaurantIds.add(item.restaurantId)
          }
        })
      }
    })

    // Get recommended restaurants based on:
    // 1. High rating (4.0+)
    // 2. Popular (many reviews)
    // 3. Not frequently ordered by user (for variety)
    const recommendedRestaurants = await prisma.restaurant.findMany({
      where: {
        star: {
          gte: 4.0,
        },
      },
      include: {
        menus: {
          take: 3,
          select: {
            id: true,
            foodName: true,
            price: true,
            type: true,
            image: true,
          },
        },
        _count: {
          select: {
            reviews: true,
          },
        },
      },
      orderBy: [{ star: "desc" }, { reviews: { _count: "desc" } }],
      take: 20,
    })

    // Format response and prioritize restaurants user hasn't ordered from frequently
    const formattedRecommendations = recommendedRestaurants
      .map((restaurant) => ({
        id: restaurant.id,
        name: restaurant.name,
        star: restaurant.star,
        place: restaurant.place,
        logo: restaurant.logo,
        images: restaurant.images,
        reviewCount: restaurant._count.reviews,
        sampleMenus: restaurant.menus,
        isFrequentlyOrdered: orderedRestaurantIds.has(restaurant.id),
      }))
      .sort((a, b) => {
        // Prioritize restaurants user hasn't ordered from frequently
        if (a.isFrequentlyOrdered && !b.isFrequentlyOrdered) return 1
        if (!a.isFrequentlyOrdered && b.isFrequentlyOrdered) return -1
        return b.star - a.star
      })
      .slice(0, 10)

    return successResponse(res, {
      recommendations: formattedRecommendations,
      message: "Recommendations based on your preferences and popular choices",
    })
  } catch (error) {
    console.error("Get recommended restaurants error:", error)
    return errorResponse(res, "Failed to get recommended restaurants")
  }
})

/**
 * @swagger
 * /api/resto/{id}:
 *   get:
 *     summary: Get restaurant detail with menus and reviews
 *     tags: [Restaurants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Restaurant ID
 *       - in: query
 *         name: limitMenu
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Maximum number of menus to return
 *       - in: query
 *         name: limitReview
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 6
 *         description: Maximum number of reviews to return
 *     responses:
 *       200:
 *         description: Restaurant detail retrieved successfully
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
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     star:
 *                       type: number
 *                     averageRating:
 *                       type: number
 *                     place:
 *                       type: string
 *                     coordinates:
 *                       type: object
 *                       properties:
 *                         lat:
 *                           type: number
 *                         long:
 *                           type: number
 *                     logo:
 *                       type: string
 *                     images:
 *                       type: array
 *                       items:
 *                         type: string
 *                     totalMenus:
 *                       type: integer
 *                     totalReviews:
 *                       type: integer
 *                     menus:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           foodName:
 *                             type: string
 *                           price:
 *                             type: integer
 *                           type:
 *                             type: string
 *                           image:
 *                             type: string
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
 *       400:
 *         description: Invalid restaurant ID
 *       404:
 *         description: Restaurant not found
 *       500:
 *         description: Internal server error
 */
// GET /resto/:id - Get restaurant detail with menus and reviews
router.get("/:id", restaurantDetailValidation, handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params
    const { limitMenu = 10, limitReview = 6 } = req.query

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: Number.parseInt(id) },
      include: {
        menus: {
          take: Number.parseInt(limitMenu),
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            foodName: true,
            price: true,
            type: true,
            image: true,
          },
        },
        reviews: {
          take: Number.parseInt(limitReview),
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            menus: true,
            reviews: true,
          },
        },
      },
    })

    if (!restaurant) {
      return errorResponse(res, "Restaurant not found", 404)
    }

    // Calculate average rating from reviews
    const avgRating =
      restaurant.reviews.length > 0
        ? restaurant.reviews.reduce((sum, review) => sum + review.star, 0) / restaurant.reviews.length
        : restaurant.star

    // Format response
    const formattedRestaurant = {
      id: restaurant.id,
      name: restaurant.name,
      star: restaurant.star,
      averageRating: Math.round(avgRating * 10) / 10,
      place: restaurant.place,
      coordinates: {
        lat: restaurant.lat,
        long: restaurant.long,
      },
      logo: restaurant.logo,
      images: restaurant.images,
      totalMenus: restaurant._count.menus,
      totalReviews: restaurant._count.reviews,
      menus: restaurant.menus,
      reviews: restaurant.reviews.map((review) => ({
        id: review.id,
        star: review.star,
        comment: review.comment,
        createdAt: review.createdAt,
        user: review.user,
      })),
    }

    return successResponse(res, formattedRestaurant)
  } catch (error) {
    console.error("Get restaurant detail error:", error)
    return errorResponse(res, "Failed to get restaurant detail")
  }
})

module.exports = router
