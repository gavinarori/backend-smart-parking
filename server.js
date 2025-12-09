const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const { WebSocketServer } = require("ws");

const ParkingLot = require("./models/ParkingLot");
const ParkingSlot = require("./models/ParkingSlot");

const app = express();

app.use(
  cors({
    origin: [
      "https://spot-yangu-web-app.vercel.app",
      "http://localhost:3000",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use(bodyParser.json());

mongoose.connect(
  "mongodb+srv://arorigavincode_db_user:yJ3TLiMWj1RrfCQQ@cluster0.h4c1op9.mongodb.net/parking"
);

const server = app.listen(4000, () =>
  console.log("HTTP + WS server running on port 4000")
);

const wss = new WebSocketServer({ server });

const lotClients = {};

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === "subscribe") {
        const lotId = msg.lotId;
        if (!lotClients[lotId]) lotClients[lotId] = [];
        lotClients[lotId].push(ws);
        ws.lotId = lotId;
      }
    } catch {}
  });

  ws.on("close", () => {
    if (ws.lotId && lotClients[ws.lotId]) {
      lotClients[ws.lotId] = lotClients[ws.lotId].filter((c) => c !== ws);
    }
  });
});

function broadcastToLot(lotId, payload) {
  if (!lotClients[lotId]) return;
  lotClients[lotId].forEach((ws) => {
    if (ws.readyState === 1) ws.send(JSON.stringify(payload));
  });
}

const VALID_RFID = ["ccd252", "b12a62"];

async function recalcParkingLot(lotId) {
  const slots = await ParkingSlot.find({ lotId });
  const reserved = slots.filter((s) => s.reserved).length;
  const occupied = slots.filter((s) => s.occupied).length;
  const available = slots.length - (reserved + occupied);

  await ParkingLot.findOneAndUpdate(
    { lotId },
    {
      reservedSlots: reserved,
      occupiedSlots: occupied,
      availableSlots: available,
    }
  );

  broadcastToLot(lotId, {
    type: "lot-update",
    lotId,
    data: { reservedSlots: reserved, occupiedSlots: occupied, availableSlots: available },
  });
}

app.post("/api/reserve", async (req, res) => {
  const { slotId, userId } = req.body;
  const slot = await ParkingSlot.findOne({ slotId });
  if (!slot) return res.status(404).json({ error: "Slot not found" });
  if (slot.reserved) return res.status(400).json({ error: "Slot already reserved" });

  const assigned = await ParkingSlot.find({ assignedRFID: { $in: VALID_RFID } }).lean();
  const usedRFIDs = assigned.map((s) => s.assignedRFID);
  const availableRFID = VALID_RFID.find((id) => !usedRFIDs.includes(id));
  if (!availableRFID) return res.status(400).json({ error: "No free RFID cards available" });

  slot.reserved = true;
  slot.reservedBy = userId;
  slot.assignedRFID = availableRFID;
  await slot.save();
  await recalcParkingLot(slot.lotId);

  broadcastToLot(slot.lotId, {
    type: "reservation-update",
    lotId: slot.lotId,
    data: slot,
  });

  res.json({ success: true, message: "Slot reserved", assignedRFID: availableRFID, slot });
});

app.post("/api/auth/rfid", async (req, res) => {
  const { rfid, slotId } = req.body;
  if (!VALID_RFID.includes(rfid)) return res.json({ status: "FAIL", reason: "Unknown RFID" });

  const slot = await ParkingSlot.findOne({ slotId });
  if (!slot) return res.json({ status: "FAIL", reason: "Invalid slot" });

  slot.lastRFID = rfid;

  if (!slot.reserved && !slot.occupied) {
    slot.occupied = true;
    await slot.save();
    await recalcParkingLot(slot.lotId);

    broadcastToLot(slot.lotId, { type: "occupancy-update", lotId: slot.lotId, data: slot });
    return res.json({ status: "SUCCESS", message: "Car authenticated. Slot now occupied." });
  }

  if (slot.reserved && slot.assignedRFID !== rfid)
    return res.json({ status: "FAIL", reason: "This slot is reserved for another user" });

  if (slot.reserved && slot.assignedRFID === rfid) {
    slot.reserved = false;
    slot.reservedBy = null;
    slot.assignedRFID = null;
    slot.occupied = true;
    await slot.save();
    await recalcParkingLot(slot.lotId);

    broadcastToLot(slot.lotId, { type: "occupancy-update", lotId: slot.lotId, data: slot });
    return res.json({ status: "SUCCESS", message: "Reservation matched. Slot now occupied." });
  }

  if (slot.occupied) return res.json({ status: "FAIL", reason: "Slot already occupied" });
});

app.post("/api/slot/:slotId/update", async (req, res) => {
  const { slotId } = req.params;
  const { rfid, occupied, gps } = req.body;

  const slot = await ParkingSlot.findOne({ slotId });
  if (!slot) return res.status(404).json({ error: "Slot not found" });

  if (rfid) slot.lastRFID = rfid;
  if (typeof occupied === "boolean") slot.occupied = occupied;
  if (gps) slot.gps = gps;
  slot.updatedAt = new Date();
  await slot.save();
  await recalcParkingLot(slot.lotId);

  broadcastToLot(slot.lotId, { type: "slot-update", lotId: slot.lotId, data: slot });
  res.json({ success: true, slot });
});

app.get("/api/slot/:slotId/status", async (req, res) => {
  const { slotId } = req.params;
  const slot = await ParkingSlot.findOne({ slotId });
  if (!slot) return res.status(404).json({ error: "Slot not found" });

  res.json({ reserved: slot.reserved, reservedBy: slot.reservedBy, occupied: slot.occupied });
});

app.get("/api/lots/:lotId", async (req, res) => {
  const lot = await ParkingLot.findOne({ lotId: req.params.lotId }).populate("slots");
  if (!lot) return res.status(404).json({ error: "Lot not found" });
  res.json(lot);
});

app.get("/api/lots", async (req, res) => {
  const lots = await ParkingLot.find().lean();
  res.json(lots);
});

const slotStream = ParkingSlot.watch();
slotStream.on("change", async (change) => {
  if (change.operationType === "update" || change.operationType === "replace") {
    const slotId = change.documentKey._id;
    const slot = await ParkingSlot.findById(slotId);
    if (!slot) return;
    await recalcParkingLot(slot.lotId);
    broadcastToLot(slot.lotId, { type: "slot-update", lotId: slot.lotId, data: slot });
  }
});
