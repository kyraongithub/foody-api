const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const { body, validationResult } = require("express-validator")
const { prisma } = require("../config/database")
const { successResponse, errorResponse } = require("../utils/response")

const router = express.Router()

// Validation rules
const registerValidation = [
  body("name").trim().isLength({ min: 2 }).withMessage("Name must be at least 2 characters"),
  body("email").isEmail().normalizeEmail().withMessage("Please provide a valid email"),
  body("phone").isMobilePhone("id-ID").withMessage("Please provide a valid Indonesian phone number"),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
]

const loginValidation = [
  body("email").isEmail().normalizeEmail().withMessage("Please provide a valid email"),
  body("password").notEmpty().withMessage("Password is required"),
]

const updateProfileValidation = [
  body("name").optional().trim().isLength({ min: 2 }).withMessage("Name must be at least 2 characters"),
  body("phone").optional().isMobilePhone("id-ID").withMessage("Please provide a valid Indonesian phone number"),
  body("currentPassword").optional().notEmpty().withMessage("Current password is required when changing password"),
  body("newPassword").optional().isLength({ min: 6 }).withMessage("New password must be at least 6 characters"),
]

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  })
}

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - phone
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *               phone:
 *                 type: string
 *                 example: "081234567890"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "password123"
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         user:
 *                           $ref: '#/components/schemas/User'
 *                         token:
 *                           type: string
 *       400:
 *         description: Validation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: User already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// POST /register
router.post("/register", registerValidation, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return errorResponse(res, "Validation failed", 400, errors.array())
    }

    const { name, email, phone, password } = req.body

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { phone }],
      },
    })

    if (existingUser) {
      return errorResponse(res, "User with this email or phone already exists", 409)
    }

    // Hash password
    const saltRounds = 12
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
      },
    })

    // Generate token
    const token = generateToken(user.id)

    return successResponse(
      res,
      {
        user,
        token,
      },
      "User registered successfully",
      201,
    )
  } catch (error) {
    console.error("Register error:", error)
    return errorResponse(res, "Failed to register user")
  }
})

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *               password:
 *                 type: string
 *                 example: "password123"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         user:
 *                           $ref: '#/components/schemas/User'
 *                         token:
 *                           type: string
 *       400:
 *         description: Validation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// POST /login
router.post("/login", loginValidation, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return errorResponse(res, "Validation failed", 400, errors.array())
    }

    const { email, password } = req.body

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return errorResponse(res, "Invalid email or password", 401)
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return errorResponse(res, "Invalid email or password", 401)
    }

    // Generate token
    const token = generateToken(user.id)

    // Return user data without password
    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
    }

    return successResponse(
      res,
      {
        user: userData,
        token,
      },
      "Login successful",
    )
  } catch (error) {
    console.error("Login error:", error)
    return errorResponse(res, "Failed to login")
  }
})

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   put:
 *     summary: Update user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 example: "John Doe Updated"
 *               phone:
 *                 type: string
 *                 example: "081234567891"
 *               currentPassword:
 *                 type: string
 *                 description: Required when changing password
 *                 example: "oldpassword123"
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 description: New password (optional)
 *                 example: "newpassword123"
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation failed or invalid current password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Phone number already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /profile (protected route for testing)
router.get("/profile", require("../middleware/auth").authenticateToken, async (req, res) => {
  try {
    return successResponse(res, req.user, "Profile retrieved successfully")
  } catch (error) {
    console.error("Profile error:", error)
    return errorResponse(res, "Failed to get profile")
  }
})

// PUT /profile
router.put("/profile", require("../middleware/auth").authenticateToken, updateProfileValidation, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return errorResponse(res, "Validation failed", 400, errors.array())
    }

    const { name, phone, currentPassword, newPassword } = req.body
    const userId = req.user.id

    // Get current user data
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!currentUser) {
      return errorResponse(res, "User not found", 404)
    }

    // Prepare update data
    const updateData = {}

    // Update name if provided
    if (name) {
      updateData.name = name
    }

    // Update phone if provided
    if (phone) {
      // Check if phone number is already taken by another user
      const existingPhone = await prisma.user.findFirst({
        where: {
          phone,
          id: { not: userId },
        },
      })

      if (existingPhone) {
        return errorResponse(res, "Phone number already exists", 409)
      }

      updateData.phone = phone
    }

    // Update password if provided
    if (newPassword) {
      if (!currentPassword) {
        return errorResponse(res, "Current password is required when changing password", 400)
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, currentUser.password)
      if (!isCurrentPasswordValid) {
        return errorResponse(res, "Current password is incorrect", 400)
      }

      // Hash new password
      const saltRounds = 12
      updateData.password = await bcrypt.hash(newPassword, saltRounds)
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return successResponse(res, updatedUser, "Profile updated successfully")
  } catch (error) {
    console.error("Update profile error:", error)
    return errorResponse(res, "Failed to update profile")
  }
})

module.exports = router
