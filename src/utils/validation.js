const { body, query, param } = require("express-validator")

// Common validation rules
const emailValidation = body("email").isEmail().normalizeEmail().withMessage("Please provide a valid email")

const passwordValidation = body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters")

const phoneValidation = body("phone")
  .isMobilePhone("id-ID")
  .withMessage("Please provide a valid Indonesian phone number")

const nameValidation = body("name").trim().isLength({ min: 2 }).withMessage("Name must be at least 2 characters")

// ID parameter validation
const idParamValidation = param("id").isInt({ min: 1 }).withMessage("ID must be a positive integer")

// Query parameter validations
const locationQueryValidation = query("location")
  .optional()
  .trim()
  .isLength({ min: 1 })
  .withMessage("Location cannot be empty")

const rangeQueryValidation = query("range")
  .optional()
  .isFloat({ min: 0 })
  .withMessage("Range must be a positive number")

const priceQueryValidation = (field) =>
  query(field).optional().isInt({ min: 0 }).withMessage(`${field} must be a positive integer`)

const ratingQueryValidation = query("rating")
  .optional()
  .isFloat({ min: 0, max: 5 })
  .withMessage("Rating must be between 0 and 5")

const statusQueryValidation = query("status")
  .optional()
  .isIn(["preparing", "on_the_way", "delivered", "done", "cancelled"])
  .withMessage("Invalid status value")

module.exports = {
  emailValidation,
  passwordValidation,
  phoneValidation,
  nameValidation,
  idParamValidation,
  locationQueryValidation,
  rangeQueryValidation,
  priceQueryValidation,
  ratingQueryValidation,
  statusQueryValidation,
}
