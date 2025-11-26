const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");

const ParkingLot = require("./models/ParkingLot");
const ParkingSlot = require("./models/ParkingSlot");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// -----------------------------
// MONGODB CONNECTION
// -----------------------------
mongoose.connect(
 "mongodb+srv://arorigavincode_db_user:yJ3TLiMWj1RrfCQQ@cluster0.h4c1op9.mongodb.net/parking"
  
);

// -----------------------------
// HELPER: Recalculate parking lot totals
// -----------------------------
async function recalcParkingLot(lotId) {
  const slots = await ParkingSlot.find({ lotId });

  const reserved = slots.filter(s => s.reserved).length;
  const occupied = slots.filter(s => s.occupied).length;

  await ParkingLot.findOneAndUpdate(
    { lotId },
    {
      reservedSlots: reserved,
      occupiedSlots: occupied,
      availableSlots: (slots.length - (reserved + occupied))
    }
  );
}

// -----------------------------
// WEB APP → RESERVE SLOT
// -----------------------------
app.post("/api/reserve", async (req, res) => {
  const { slotId, userId } = req.body;

  const slot = await ParkingSlot.findOne({ slotId });
  if (!slot) return res.status(404).json({ error: "Slot not found" });
  if (slot.reserved) return res.status(400).json({ error: "Slot already reserved" });

  slot.reserved = true;
  slot.reservedBy = userId;
  await slot.save();

  await recalcParkingLot(slot.lotId);

  res.json({ success: true, message: "Slot reserved", slot });
});

// -----------------------------
// ESP32 → UPDATE SLOT STATUS
// -----------------------------
app.post("/api/slot/:slotId/update", async (req, res) => {
  const { slotId } = req.params;
  const { rfid, occupied, gps } = req.body;

  const slot = await ParkingSlot.findOne({ slotId });
  if (!slot) return res.status(404).json({ error: "Slot not found" });

  slot.lastRFID = rfid || slot.lastRFID;
  slot.occupied = occupied;
  slot.gps = gps || slot.gps;
  slot.updatedAt = new Date();
  await slot.save();

  await recalcParkingLot(slot.lotId);

  res.json({ success: true, slot });
});

// -----------------------------
// ESP32 → GET CURRENT SLOT STATUS
// -----------------------------
app.get("/api/slot/:slotId/status", async (req, res) => {
  const { slotId } = req.params;

  const slot = await ParkingSlot.findOne({ slotId });
  if (!slot) return res.status(404).json({ error: "Slot not found" });

  res.json({
    reserved: slot.reserved,
    reservedBy: slot.reservedBy,
    occupied: slot.occupied
  });
});

// -----------------------------
// WEB → GET FULL PARKING LOT OVERVIEW
// -----------------------------
app.get("/api/lots/:lotId", async (req, res) => {
  const lot = await ParkingLot.findOne({ lotId: req.params.lotId }).populate("slots");
  if (!lot) return res.status(404).json({ error: "Lot not found" });

  res.json(lot);
});

app.get("/api/lots", async (req, res) => {
  const lots = await ParkingLot.find().lean();
  res.json(lots);
});

// -----------------------------
app.listen(4000, () => console.log("Server running on port 4000"));
