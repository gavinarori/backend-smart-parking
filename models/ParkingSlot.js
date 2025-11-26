const mongoose = require("mongoose");

const parkingSlotSchema = new mongoose.Schema({
  slotId: { type: String, required: true },
  reserved: { type: Boolean, default: false },
  reservedBy: { type: String, default: null },
  occupied: { type: Boolean, default: false },
  lastRFID: { type: String, default: null },
  gps: {
    lat: Number,
    lon: Number
  },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("ParkingSlot", parkingSlotSchema);
