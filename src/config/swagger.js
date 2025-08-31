const swaggerJsdoc = require("swagger-jsdoc")

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Foody API",
      version: "1.0.0",
      description: "Food delivery API with Express.js, PostgreSQL, and Prisma",
      contact: {
        name: "Foody Team",
        email: "support@foody.com",
      },
    },
    servers: [
      {
        url: process.env.NODE_ENV === "production" ? "https://your-vercel-app.vercel.app" : "http://localhost:3000",
        description: process.env.NODE_ENV === "production" ? "Production server" : "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: { type: "integer" },
            name: { type: "string" },
            email: { type: "string", format: "email" },
            phone: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Restaurant: {
          type: "object",
          properties: {
            id: { type: "integer" },
            name: { type: "string" },
            star: { type: "number", format: "float" },
            place: { type: "string" },
            lat: { type: "number", format: "float" },
            long: { type: "number", format: "float" },
            logo: { type: "string" },
            images: { type: "array", items: { type: "string" } },
          },
        },
        Menu: {
          type: "object",
          properties: {
            id: { type: "integer" },
            food_name: { type: "string" },
            price: { type: "integer" },
            type: { type: "string", enum: ["food", "drink"] },
            resto_id: { type: "integer" },
          },
        },
        CartItem: {
          type: "object",
          properties: {
            id: { type: "integer" },
            user_id: { type: "integer" },
            resto_id: { type: "integer" },
            menu_id: { type: "integer" },
            quantity: { type: "integer", default: 1 },
          },
        },
        Transaction: {
          type: "object",
          properties: {
            transaction_id: { type: "string" },
            user_id: { type: "integer" },
            payment_method: { type: "string" },
            price: { type: "integer" },
            service_fee: { type: "integer" },
            delivery_fee: { type: "integer" },
            total_price: { type: "integer" },
            status: { type: "string", enum: ["preparing", "on_the_way", "delivered", "cancelled"] },
          },
        },
        Review: {
          type: "object",
          properties: {
            id: { type: "integer" },
            user_id: { type: "integer" },
            resto_id: { type: "integer" },
            transaction_id: { type: "string" },
            star: { type: "integer", minimum: 1, maximum: 5 },
            comment: { type: "string" },
          },
        },
        Error: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string" },
            errors: { type: "array", items: { type: "string" } },
          },
        },
        Success: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string" },
            data: { type: "object" },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.js"], // Path to the API files
}

const specs = swaggerJsdoc(options)
module.exports = specs
