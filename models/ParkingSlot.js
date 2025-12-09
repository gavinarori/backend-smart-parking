const mongoose = require("mongoose");

const ParkingSlotSchema = new mongoose.Schema({
  slotId: { type: String, required: true, unique: true },
  lotId: { type: String, required: true },

  reserved: { type: Boolean, default: false },
  reservedBy: { type: String, default: null },
  occupied: { type: Boolean, default: false },

  assignedRFID: { type: String, default: null },  
  lastRFID: { type: String, default: null },

  gps: { type: Object, default: null },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("ParkingSlot", ParkingSlotSchema);
