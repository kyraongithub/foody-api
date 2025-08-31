const express = require("express")
const { body, query } = require("express-validator")
const { prisma } = require("../config/database")
const { successResponse, errorResponse } = require("../utils/response")
const { handleValidationErrors } = require("../middleware/validation")
const { authenticateToken } = require("../middleware/auth")

const router = express.Router()

// All order routes require authentication
router.use(authenticateToken)

// Validation rules
const checkoutValidation = [
  body("paymentMethod").notEmpty().withMessage("Payment method is required"),
  body("deliveryAddress").optional().isString().withMessage("Delivery address must be a string"),
  body("notes").optional().isString().withMessage("Notes must be a string"),
]

const orderStatusValidation = [
  query("status")
    .optional()
    .isIn(["preparing", "on_the_way", "delivered", "done", "cancelled"])
    .withMessage("Invalid status value"),
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 50 }).withMessage("Limit must be between 1 and 50"),
]

/**
 * @swagger
 * /api/order/checkout:
 *   post:
 *     summary: Create order from cart items
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentMethod
 *             properties:
 *               paymentMethod:
 *                 type: string
 *                 description: Payment method for the order
 *                 example: "Bank Rakyat Indonesia"
 *               deliveryAddress:
 *                 type: string
 *                 description: Delivery address for the order
 *                 example: "Jl. Sudirman No. 25, Jakarta Pusat, 10220"
 *               notes:
 *                 type: string
 *                 description: Additional notes for the order
 *                 example: "Please ring the doorbell"
 *     responses:
 *       201:
 *         description: Order placed successfully
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
 *                   example: "Order placed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     transaction:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         transactionId:
 *                           type: string
 *                         paymentMethod:
 *                           type: string
 *                         status:
 *                           type: string
 *                           enum: [preparing, on_the_way, delivered, done, cancelled]
 *                         pricing:
 *                           type: object
 *                           properties:
 *                             subtotal:
 *                               type: integer
 *                             serviceFee:
 *                               type: integer
 *                             deliveryFee:
 *                               type: integer
 *                             totalPrice:
 *                               type: integer
 *                         restaurants:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               restaurant:
 *                                 type: object
 *                                 properties:
 *                                   id:
 *                                     type: integer
 *                                   name:
 *                                     type: string
 *                                   logo:
 *                                     type: string
 *                               items:
 *                                 type: array
 *                                 items:
 *                                   type: object
 *                                   properties:
 *                                     menuId:
 *                                       type: integer
 *                                     menuName:
 *                                       type: string
 *                                     price:
 *                                       type: integer
 *                                     quantity:
 *                                       type: integer
 *                                     itemTotal:
 *                                       type: integer
 *                               subtotal:
 *                                 type: integer
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: Cart is empty or invalid input data
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
// POST /checkout - Create order from cart
router.post("/checkout", checkoutValidation, handleValidationErrors, async (req, res) => {
  try {
    const userId = req.user.id
    const { paymentMethod, deliveryAddress, notes } = req.body

    // Get user's cart items
    const cartItems = await prisma.userCartItem.findMany({
      where: { userId },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
        },
        menu: {
          select: {
            id: true,
            foodName: true,
            price: true,
            type: true,
            image: true,
          },
        },
      },
    })

    if (cartItems.length === 0) {
      return errorResponse(res, "Cart is empty", 400)
    }

    // Calculate totals
    let subtotal = 0
    const orderItems = []

    // Group items by restaurant for the order
    const restaurantGroups = {}

    cartItems.forEach((item) => {
      const itemTotal = item.menu.price * item.quantity
      subtotal += itemTotal

      // Add to order items
      orderItems.push({
        restaurantId: item.restaurantId,
        restaurantName: item.restaurant.name,
        menuId: item.menuId,
        menuName: item.menu.foodName,
        price: item.menu.price,
        quantity: item.quantity,
        itemTotal,
      })

      // Group by restaurant
      if (!restaurantGroups[item.restaurantId]) {
        restaurantGroups[item.restaurantId] = {
          restaurant: item.restaurant,
          items: [],
          subtotal: 0,
        }
      }

      restaurantGroups[item.restaurantId].items.push({
        menuId: item.menuId,
        menuName: item.menu.foodName,
        price: item.menu.price,
        quantity: item.quantity,
        itemTotal,
      })

      restaurantGroups[item.restaurantId].subtotal += itemTotal
    })

    // Calculate fees
    const serviceFee = 1000 // Fixed service fee
    const deliveryFee = 10000 // Fixed delivery fee
    const totalPrice = subtotal + serviceFee + deliveryFee

    // Generate unique transaction ID
    const transactionId = `TXN${Date.now()}${userId}`

    // Create transaction
    const transaction = await prisma.transaction.create({
      data: {
        transactionId,
        userId,
        paymentMethod,
        price: subtotal,
        serviceFee,
        deliveryFee,
        totalPrice,
        status: "preparing",
        items: orderItems,
      },
    })

    // Clear user's cart after successful checkout
    await prisma.userCartItem.deleteMany({
      where: { userId },
    })

    return successResponse(
      res,
      {
        transaction: {
          id: transaction.id,
          transactionId: transaction.transactionId,
          paymentMethod: transaction.paymentMethod,
          status: transaction.status,
          pricing: {
            subtotal,
            serviceFee,
            deliveryFee,
            totalPrice,
          },
          restaurants: Object.values(restaurantGroups),
          createdAt: transaction.createdAt,
        },
      },
      "Order placed successfully",
      201,
    )
  } catch (error) {
    console.error("Checkout error:", error)
    return errorResponse(res, "Failed to process checkout")
  }
})

/**
 * @swagger
 * /api/order/my-order:
 *   get:
 *     summary: Get user's orders with optional status filter
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [preparing, on_the_way, delivered, done, cancelled]
 *         description: Filter orders by status
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
 *         description: Number of orders per page
 *     responses:
 *       200:
 *         description: Orders retrieved successfully
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
 *                     orders:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           transactionId:
 *                             type: string
 *                           status:
 *                             type: string
 *                             enum: [preparing, on_the_way, delivered, done, cancelled]
 *                           paymentMethod:
 *                             type: string
 *                           pricing:
 *                             type: object
 *                             properties:
 *                               subtotal:
 *                                 type: integer
 *                               serviceFee:
 *                                 type: integer
 *                               deliveryFee:
 *                                 type: integer
 *                               totalPrice:
 *                                 type: integer
 *                           restaurants:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 restaurantId:
 *                                   type: integer
 *                                 restaurantName:
 *                                   type: string
 *                                 items:
 *                                   type: array
 *                                   items:
 *                                     type: object
 *                                     properties:
 *                                       menuId:
 *                                         type: integer
 *                                       menuName:
 *                                         type: string
 *                                       price:
 *                                         type: integer
 *                                       quantity:
 *                                         type: integer
 *                                       itemTotal:
 *                                         type: integer
 *                                 subtotal:
 *                                   type: integer
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
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
 *                     filter:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *       400:
 *         description: Invalid query parameters
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
// GET /my-order - Get user's orders with optional status filter
router.get("/my-order", orderStatusValidation, handleValidationErrors, async (req, res) => {
  try {
    const userId = req.user.id
    const { status, page = 1, limit = 10 } = req.query

    // Build where clause
    const whereClause = { userId }
    if (status) {
      whereClause.status = status
    }

    // Get total count for pagination
    const totalOrders = await prisma.transaction.count({
      where: whereClause,
    })

    // Get orders with pagination
    const orders = await prisma.transaction.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      skip: (Number.parseInt(page) - 1) * Number.parseInt(limit),
      take: Number.parseInt(limit),
    })

    // Format orders by grouping items by restaurant
    const formattedOrders = orders.map((order) => {
      // Group items by restaurant
      const restaurantGroups = {}

      if (order.items && Array.isArray(order.items)) {
        order.items.forEach((item) => {
          if (!restaurantGroups[item.restaurantId]) {
            restaurantGroups[item.restaurantId] = {
              restaurantId: item.restaurantId,
              restaurantName: item.restaurantName,
              items: [],
              subtotal: 0,
            }
          }

          restaurantGroups[item.restaurantId].items.push({
            menuId: item.menuId,
            menuName: item.menuName,
            price: item.price,
            quantity: item.quantity,
            itemTotal: item.itemTotal,
          })

          restaurantGroups[item.restaurantId].subtotal += item.itemTotal
        })
      }

      return {
        id: order.id,
        transactionId: order.transactionId,
        status: order.status,
        paymentMethod: order.paymentMethod,
        pricing: {
          subtotal: order.price,
          serviceFee: order.serviceFee,
          deliveryFee: order.deliveryFee,
          totalPrice: order.totalPrice,
        },
        restaurants: Object.values(restaurantGroups),
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      }
    })

    return successResponse(res, {
      orders: formattedOrders,
      pagination: {
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        total: totalOrders,
        totalPages: Math.ceil(totalOrders / Number.parseInt(limit)),
      },
      filter: {
        status: status || "all",
      },
    })
  } catch (error) {
    console.error("Get my orders error:", error)
    return errorResponse(res, "Failed to get orders")
  }
})

/**
 * @swagger
 * /api/order/{id}/status:
 *   put:
 *     summary: Update order status
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Order ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [preparing, on_the_way, delivered, done, cancelled]
 *                 description: New status for the order
 *                 example: "on_the_way"
 *     responses:
 *       200:
 *         description: Order status updated successfully
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
 *                     order:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         transactionId:
 *                           type: string
 *                         status:
 *                           type: string
 *                         updatedAt:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: Invalid status value
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Order not found
 *       500:
 *         description: Internal server error
 */
// PUT /order/:id/status - Update order status (for testing/admin purposes)
router.put("/:id/status", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body
    const userId = req.user.id

    // Validate status
    const validStatuses = ["preparing", "on_the_way", "delivered", "done", "cancelled"]
    if (!validStatuses.includes(status)) {
      return errorResponse(res, "Invalid status", 400)
    }

    // Find and update order (ensure it belongs to the user)
    const order = await prisma.transaction.findFirst({
      where: {
        id: Number.parseInt(id),
        userId,
      },
    })

    if (!order) {
      return errorResponse(res, "Order not found", 404)
    }

    const updatedOrder = await prisma.transaction.update({
      where: { id: Number.parseInt(id) },
      data: { status },
    })

    return successResponse(res, {
      order: {
        id: updatedOrder.id,
        transactionId: updatedOrder.transactionId,
        status: updatedOrder.status,
        updatedAt: updatedOrder.updatedAt,
      },
    })
  } catch (error) {
    console.error("Update order status error:", error)
    return errorResponse(res, "Failed to update order status")
  }
})

module.exports = router
