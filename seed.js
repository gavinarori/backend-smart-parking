const mongoose = require("mongoose");
const ParkingLot = require("./models/ParkingLot");
const ParkingSlot = require("./models/ParkingSlot");

mongoose.connect(
  "mongodb+srv://arorigavincode_db_user:yJ3TLiMWj1RrfCQQ@cluster0.h4c1op9.mongodb.net/parking"
);

// Generate mock slots
function generateMockSlots(lotId, count, baseCoordinates) {
  const slots = [];

  for (let i = 1; i <= count; i++) {
    slots.push(
      new ParkingSlot({
        slotId: `${lotId}-S${i.toString().padStart(2, "0")}`,
        lotId: lotId,
        reserved: false,
        occupied: false,
        gps: {
          lat: baseCoordinates.lat + Math.random() * 0.0002,
          lon: baseCoordinates.lng + Math.random() * 0.0002
        }
      })
    );
  }

  return slots;
}

async function seed() {
  await ParkingLot.deleteMany({});
  await ParkingSlot.deleteMany({});

  const lotId = "lot-2";

  const slots = generateMockSlots(lotId, 60, {
    lat: -0.3979,
    lng: 36.9622
  });

  const savedSlots = await ParkingSlot.insertMany(slots);

  const lot = new ParkingLot({
    lotId: lotId,
    name: "Library Parking",
    address: "Dedan Kimathi University, Library Zone, Nyeri",
    coordinates: { lat: -0.3979, lng: 36.9622 },
    totalSlots: 60,
    availableSlots: 60,
    reservedSlots: 0,
    occupiedSlots: 0,
    pricePerHour: 15.0,
    operatingHours: { open: "07:00", close: "21:00" },
    slots: savedSlots.map(s => s._id)
  });

  await lot.save();

  console.log("Database seeded with parking lot + slots!");
  process.exit();
}

seed();
