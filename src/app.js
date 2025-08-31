require("dotenv").config()
const express = require("express")
const cors = require("cors")
const { connectDB } = require("./config/database")
const swaggerUi = require("swagger-ui-express")
const swaggerSpecs = require("./config/swagger")

const app = express()

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Connect to database
connectDB()

// Swagger UI route at /api-swagger
app.use(
  "/api-swagger",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpecs, {
    explorer: true,
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Foody API Documentation",
  }),
)

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Foody API is running!",
    timestamp: new Date().toISOString(),
  })
})

app.use("/api/auth", require("./routes/auth"))
app.use("/api/resto", require("./routes/restaurant"))
app.use("/api/cart", require("./routes/cart"))
app.use("/api/order", require("./routes/order"))
app.use("/api/review", require("./routes/review"))

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  })
})

// Error handler
app.use((error, req, res, next) => {
  console.error("Error:", error)
  res.status(500).json({
    success: false,
    message: "Internal server error",
  })
})

module.exports = app
