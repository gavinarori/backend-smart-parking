const mongoose = require("mongoose");

const parkingLotSchema = new mongoose.Schema({
  lotId: { type: String, unique: true },
  name: String,
  address: String,
  coordinates: {
    lat: Number,
    lng: Number
  },

  // UNEDITABLE TOTAL
  totalSlots: { type: Number, immutable: true },

  // DYNAMIC FIELDS
  availableSlots: { type: Number, default: 0 },
  reservedSlots: { type: Number, default: 0 },
  occupiedSlots: { type: Number, default: 0 },

  pricePerHour: Number,
  operatingHours: {
    open: String,
    close: String
  },

  // relation
  slots: [{ type: mongoose.Schema.Types.ObjectId, ref: "ParkingSlot" }]
});

module.exports = mongoose.model("ParkingLot", parkingLotSchema);
