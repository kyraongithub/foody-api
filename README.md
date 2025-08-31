# Foody API

A comprehensive food delivery API built with Express.js, PostgreSQL, and Prisma ORM.

## Features

- **Authentication System**: JWT-based authentication with register/login
- **Restaurant Management**: Browse restaurants with advanced filtering
- **Menu System**: Restaurant menus with categories and pricing
- **Cart Management**: Add, update, remove items from cart
- **Order Processing**: Complete checkout and order tracking
- **Review System**: Rate and review restaurants
- **Recommendation Engine**: Personalized restaurant recommendations

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile (protected)

### Restaurants
- `GET /api/resto` - Get restaurants with filters (location, range, price, rating)
- `GET /api/resto/recommended` - Get recommended restaurants (protected)
- `GET /api/resto/:id` - Get restaurant details with menus and reviews

### Cart Management
- `GET /api/cart` - Get user's cart (protected)
- `POST /api/cart` - Add item to cart (protected)
- `PUT /api/cart/:id` - Update cart item quantity (protected)
- `DELETE /api/cart/:id` - Remove item from cart (protected)
- `DELETE /api/cart` - Clear entire cart (protected)

### Order Management
- `POST /api/order/checkout` - Create order from cart (protected)
- `GET /api/order/my-order` - Get user's orders with status filter (protected)
- `PUT /api/order/:id/status` - Update order status (protected)

### Reviews
- `POST /api/review` - Create restaurant review (protected)
- `GET /api/review/restaurant/:restaurantId` - Get restaurant reviews
- `GET /api/review/my-reviews` - Get user's reviews (protected)
- `PUT /api/review/:id` - Update review (protected)
- `DELETE /api/review/:id` - Delete review (protected)

## Setup Instructions

1. **Install Dependencies**
   \`\`\`bash
   npm install
   \`\`\`

2. **Environment Setup**
   Create a `.env` file with:
   \`\`\`env
   DATABASE_URL="postgresql://username:password@localhost:5432/foody_db?schema=public"
   JWT_SECRET="your-super-secret-jwt-key-here"
   JWT_EXPIRES_IN="7d"
   PORT=3000
   NODE_ENV="development"
   \`\`\`

3. **Database Setup**
   \`\`\`bash
   # Generate Prisma client
   npm run db:generate
   
   # Push schema to database
   npm run db:push
   
   # Seed database with sample data
   npm run db:seed
   \`\`\`

4. **Start Server**
   \`\`\`bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   \`\`\`

## Database Schema

- **Users**: User accounts with authentication
- **Restaurants**: Restaurant information and location data
- **Resto Menus**: Menu items for each restaurant
- **Resto Reviews**: User reviews and ratings
- **User Cart Items**: Shopping cart functionality
- **Transactions**: Order history and payment tracking

## API Response Format

### Success Response
\`\`\`json
{
  "success": true,
  "message": "Success message",
  "data": { ... }
}
\`\`\`

### Error Response
\`\`\`json
{
  "success": false,
  "message": "Error message",
  "errors": [ ... ] // Optional validation errors
}
\`\`\`

## Authentication

Protected routes require a Bearer token in the Authorization header:
\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## Features Highlights

- **Advanced Filtering**: Filter restaurants by location, distance, price range, and ratings
- **Smart Recommendations**: Personalized suggestions based on user order history
- **Cart Grouping**: Items automatically grouped by restaurant
- **Order Tracking**: Multiple order statuses (preparing, on_the_way, delivered, done, cancelled)
- **Review System**: Rate restaurants with automatic average rating updates
- **Input Validation**: Comprehensive validation for all endpoints
- **Error Handling**: Consistent error responses across all endpoints

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: express-validator
- **Security**: bcryptjs for password hashing
