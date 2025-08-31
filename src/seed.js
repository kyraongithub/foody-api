const { prisma } = require("./config/database")

async function main() {
  console.log("🌱 Starting database seeding...")

  // Create sample restaurants
  const restaurants = await prisma.restaurant.createMany({
    data: [
      {
        name: "Burger King",
        star: 4.5,
        place: "Jakarta Selatan",
        lat: -6.2088,
        long: 106.8456,
        logo: "https://example.com/burger-king-logo.png",
        images: ["https://example.com/bk1.jpg", "https://example.com/bk2.jpg"],
      },
      {
        name: "Pizza Hut",
        star: 4.2,
        place: "Jakarta Pusat",
        lat: -6.1751,
        long: 106.865,
        logo: "https://example.com/pizza-hut-logo.png",
        images: ["https://example.com/ph1.jpg", "https://example.com/ph2.jpg"],
      },
      {
        name: "KFC",
        star: 4.0,
        place: "Jakarta Utara",
        lat: -6.1344,
        long: 106.865,
        logo: "https://example.com/kfc-logo.png",
        images: ["https://example.com/kfc1.jpg", "https://example.com/kfc2.jpg"],
      },
    ],
  })

  // Get created restaurants
  const restoList = await prisma.restaurant.findMany()

  // Create sample menus
  for (const resto of restoList) {
    await prisma.restoMenu.createMany({
      data: [
        {
          restaurantId: resto.id,
          foodName: `${resto.name} Burger`,
          price: 50000,
          type: "food",
          image: "https://example.com/burger.jpg",
        },
        {
          restaurantId: resto.id,
          foodName: `${resto.name} Fries`,
          price: 25000,
          type: "food",
          image: "https://example.com/fries.jpg",
        },
        {
          restaurantId: resto.id,
          foodName: "Coca Cola",
          price: 15000,
          type: "drink",
          image: "https://example.com/coke.jpg",
        },
      ],
    })
  }

  console.log("✅ Database seeded successfully!")
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
