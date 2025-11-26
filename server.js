const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");

const ParkingSlot = require("./models/ParkingSlot");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// MongoDB connect
mongoose.connect("mongodb+srv://arorigavincode_db_user:yJ3TLiMWj1RrfCQQ@cluster0.h4c1op9.mongodb.net/parking");

// -------------------------
// WEB APP → RESERVE SLOT
// -------------------------
app.post("/api/reserve", async (req, res) => {
  const { slotId, userId } = req.body;

  const slot = await ParkingSlot.findOne({ slotId });

  if (!slot) return res.status(404).json({ error: "Slot not found" });
  if (slot.reserved) return res.status(400).json({ error: "Slot already reserved" });

  slot.reserved = true;
  slot.reservedBy = userId;
  await slot.save();

  res.json({ success: true, message: "Slot reserved", slot });
});

// -------------------------
// ESP32 → UPDATE SLOT STATUS
// -------------------------
app.post("/api/slot/:id/update", async (req, res) => {
  const slotId = req.params.id;

  const { rfid, occupied, gps } = req.body;

  const slot = await ParkingSlot.findOne({ slotId });

  if (!slot)
    return res.status(404).json({ error: "Slot not found" });

  slot.lastRFID = rfid || slot.lastRFID;
  slot.occupied = occupied;
  slot.gps = gps || slot.gps;
  slot.updatedAt = new Date();
  await slot.save();

  res.json({ success: true, slot });
});

// -------------------------
// ESP32 → GET STATUS
// -------------------------
app.get("/api/slot/:id/status", async (req, res) => {
  const slotId = req.params.id;

  const slot = await ParkingSlot.findOne({ slotId });

  if (!slot)
    return res.status(404).json({ error: "Slot not found" });

  res.json({
    reserved: slot.reserved,
    reservedBy: slot.reservedBy,
    occupied: slot.occupied
  });
});

// -------------------------
app.listen(4000, () => console.log("Server running on port 4000"));
