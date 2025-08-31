const express = require("express")
const { body, param } = require("express-validator")
const { prisma } = require("../config/database")
const { successResponse, errorResponse } = require("../utils/response")
const { handleValidationErrors } = require("../middleware/validation")
const { authenticateToken } = require("../middleware/auth")

const router = express.Router()

// All cart routes require authentication
router.use(authenticateToken)

// Validation rules
const addToCartValidation = [
  body("restaurantId").isInt({ min: 1 }).withMessage("Restaurant ID must be a positive integer"),
  body("menuId").isInt({ min: 1 }).withMessage("Menu ID must be a positive integer"),
  body("quantity").optional().isInt({ min: 1 }).withMessage("Quantity must be a positive integer"),
]

const updateCartValidation = [
  param("id").isInt({ min: 1 }).withMessage("Cart item ID must be a positive integer"),
  body("quantity").isInt({ min: 1 }).withMessage("Quantity must be a positive integer"),
]

/**
 * @swagger
 * /api/cart:
 *   get:
 *     summary: Get user's cart items grouped by restaurant
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart retrieved successfully
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
 *                     cart:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           restaurant:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                               name:
 *                                 type: string
 *                               logo:
 *                                 type: string
 *                           items:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: integer
 *                                 menu:
 *                                   type: object
 *                                   properties:
 *                                     id:
 *                                       type: integer
 *                                     foodName:
 *                                       type: string
 *                                     price:
 *                                       type: integer
 *                                     type:
 *                                       type: string
 *                                     image:
 *                                       type: string
 *                                 quantity:
 *                                   type: integer
 *                                 itemTotal:
 *                                   type: integer
 *                           subtotal:
 *                             type: integer
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalItems:
 *                           type: integer
 *                         totalPrice:
 *                           type: integer
 *                         restaurantCount:
 *                           type: integer
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
// GET /cart - Get user's cart
router.get("/", async (req, res) => {
  try {
    const userId = req.user.id

    // Get cart items grouped by restaurant
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
      orderBy: { createdAt: "desc" },
    })

    // Group items by restaurant
    const groupedCart = {}
    let totalItems = 0
    let totalPrice = 0

    cartItems.forEach((item) => {
      const restaurantId = item.restaurantId
      const itemTotal = item.menu.price * item.quantity

      totalItems += item.quantity
      totalPrice += itemTotal

      if (!groupedCart[restaurantId]) {
        groupedCart[restaurantId] = {
          restaurant: item.restaurant,
          items: [],
          subtotal: 0,
        }
      }

      groupedCart[restaurantId].items.push({
        id: item.id,
        menu: item.menu,
        quantity: item.quantity,
        itemTotal,
      })

      groupedCart[restaurantId].subtotal += itemTotal
    })

    // Convert to array format
    const cartArray = Object.values(groupedCart)

    return successResponse(res, {
      cart: cartArray,
      summary: {
        totalItems,
        totalPrice,
        restaurantCount: cartArray.length,
      },
    })
  } catch (error) {
    console.error("Get cart error:", error)
    return errorResponse(res, "Failed to get cart")
  }
})

/**
 * @swagger
 * /api/cart:
 *   post:
 *     summary: Add item to cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - restaurantId
 *               - menuId
 *             properties:
 *               restaurantId:
 *                 type: integer
 *                 description: ID of the restaurant
 *                 example: 1
 *               menuId:
 *                 type: integer
 *                 description: ID of the menu item
 *                 example: 5
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 default: 1
 *                 description: Quantity of the item
 *                 example: 2
 *     responses:
 *       201:
 *         description: Item added to cart successfully
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
 *                   example: "Item added to cart successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     cartItem:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         restaurant:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                             name:
 *                               type: string
 *                             logo:
 *                               type: string
 *                         menu:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                             foodName:
 *                               type: string
 *                             price:
 *                               type: integer
 *                             type:
 *                               type: string
 *                             image:
 *                               type: string
 *                         quantity:
 *                           type: integer
 *                         itemTotal:
 *                           type: integer
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Restaurant or menu item not found
 *       500:
 *         description: Internal server error
 */
// POST /cart - Add item to cart
router.post("/", addToCartValidation, handleValidationErrors, async (req, res) => {
  try {
    const userId = req.user.id
    const { restaurantId, menuId, quantity = 1 } = req.body

    // Verify restaurant exists
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    })

    if (!restaurant) {
      return errorResponse(res, "Restaurant not found", 404)
    }

    // Verify menu exists and belongs to restaurant
    const menu = await prisma.restoMenu.findFirst({
      where: {
        id: menuId,
        restaurantId,
      },
    })

    if (!menu) {
      return errorResponse(res, "Menu item not found", 404)
    }

    // Generate cart ID (could be session-based or user-based)
    const cartId = `cart_${userId}_${Date.now()}`

    // Check if item already exists in cart
    const existingCartItem = await prisma.userCartItem.findFirst({
      where: {
        userId,
        restaurantId,
        menuId,
      },
    })

    let cartItem

    if (existingCartItem) {
      // Update quantity if item already exists
      cartItem = await prisma.userCartItem.update({
        where: { id: existingCartItem.id },
        data: {
          quantity: existingCartItem.quantity + quantity,
        },
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
    } else {
      // Create new cart item
      cartItem = await prisma.userCartItem.create({
        data: {
          cartId,
          userId,
          restaurantId,
          menuId,
          quantity,
        },
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
    }

    return successResponse(
      res,
      {
        cartItem: {
          id: cartItem.id,
          restaurant: cartItem.restaurant,
          menu: cartItem.menu,
          quantity: cartItem.quantity,
          itemTotal: cartItem.menu.price * cartItem.quantity,
        },
      },
      "Item added to cart successfully",
      201,
    )
  } catch (error) {
    console.error("Add to cart error:", error)
    return errorResponse(res, "Failed to add item to cart")
  }
})

/**
 * @swagger
 * /api/cart/{id}:
 *   put:
 *     summary: Update cart item quantity
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Cart item ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - quantity
 *             properties:
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 description: New quantity for the item
 *                 example: 3
 *     responses:
 *       200:
 *         description: Cart item updated successfully
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
 *                     cartItem:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         restaurant:
 *                           type: object
 *                         menu:
 *                           type: object
 *                         quantity:
 *                           type: integer
 *                         itemTotal:
 *                           type: integer
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Cart item not found
 *       500:
 *         description: Internal server error
 *   delete:
 *     summary: Remove item from cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Cart item ID
 *     responses:
 *       200:
 *         description: Item removed from cart successfully
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
 *                   example: "Item removed from cart successfully"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Cart item not found
 *       500:
 *         description: Internal server error
 */
// PUT /cart/:id - Update cart item quantity
router.put("/:id", updateCartValidation, handleValidationErrors, async (req, res) => {
  try {
    const userId = req.user.id
    const { id } = req.params
    const { quantity } = req.body

    // Find cart item and ensure it belongs to the user
    const cartItem = await prisma.userCartItem.findFirst({
      where: {
        id: Number.parseInt(id),
        userId,
      },
    })

    if (!cartItem) {
      return errorResponse(res, "Cart item not found", 404)
    }

    // Update quantity
    const updatedCartItem = await prisma.userCartItem.update({
      where: { id: Number.parseInt(id) },
      data: { quantity },
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

    return successResponse(res, {
      cartItem: {
        id: updatedCartItem.id,
        restaurant: updatedCartItem.restaurant,
        menu: updatedCartItem.menu,
        quantity: updatedCartItem.quantity,
        itemTotal: updatedCartItem.menu.price * updatedCartItem.quantity,
      },
    })
  } catch (error) {
    console.error("Update cart item error:", error)
    return errorResponse(res, "Failed to update cart item")
  }
})

// DELETE /cart/:id - Remove item from cart
router.delete("/:id", async (req, res) => {
  try {
    const userId = req.user.id
    const { id } = req.params

    // Find cart item and ensure it belongs to the user
    const cartItem = await prisma.userCartItem.findFirst({
      where: {
        id: Number.parseInt(id),
        userId,
      },
    })

    if (!cartItem) {
      return errorResponse(res, "Cart item not found", 404)
    }

    // Delete cart item
    await prisma.userCartItem.delete({
      where: { id: Number.parseInt(id) },
    })

    return successResponse(res, null, "Item removed from cart successfully")
  } catch (error) {
    console.error("Remove cart item error:", error)
    return errorResponse(res, "Failed to remove cart item")
  }
})

/**
 * @swagger
 * /api/cart:
 *   delete:
 *     summary: Clear entire cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart cleared successfully
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
 *                   example: "Cart cleared successfully"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
// DELETE /cart - Clear entire cart
router.delete("/", async (req, res) => {
  try {
    const userId = req.user.id

    // Delete all cart items for the user
    await prisma.userCartItem.deleteMany({
      where: { userId },
    })

    return successResponse(res, null, "Cart cleared successfully")
  } catch (error) {
    console.error("Clear cart error:", error)
    return errorResponse(res, "Failed to clear cart")
  }
})

module.exports = router
