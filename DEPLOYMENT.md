# Deployment Guide for Foody API

## Vercel Deployment

This API is configured to deploy on Vercel using the Node.js runtime.

### Environment Variables Required

Set these environment variables in your Vercel project settings:

\`\`\`bash
DATABASE_URL="postgresql://username:password@host:port/database"
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="7d"
PORT="3000"
\`\`\`

### Deployment Steps

1. **Connect to Vercel:**
   \`\`\`bash
   npm i -g vercel
   vercel login
   \`\`\`

2. **Deploy:**
   \`\`\`bash
   vercel --prod
   \`\`\`

3. **Set Environment Variables:**
   - Go to your Vercel dashboard
   - Select your project
   - Go to Settings > Environment Variables
   - Add all required environment variables

4. **Database Setup:**
   - Make sure your PostgreSQL database is accessible from Vercel
   - Run database migrations if needed
   - Consider using managed PostgreSQL services like:
     - Vercel Postgres
     - Supabase
     - PlanetScale
     - Railway

### API Endpoints

Once deployed, your API will be available at:
- `https://your-project.vercel.app/api/auth/register`
- `https://your-project.vercel.app/api/auth/login`
- `https://your-project.vercel.app/api/resto`
- `https://your-project.vercel.app/api/cart`
- `https://your-project.vercel.app/api/orders`
- `https://your-project.vercel.app/api/reviews`

### Notes

- Vercel functions have a 30-second timeout limit
- Database connections should use connection pooling for better performance
- Consider using Vercel's built-in PostgreSQL for seamless integration
