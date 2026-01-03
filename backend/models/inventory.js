const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/inventree');

const demandHistorySchema = new mongoose.Schema({
    date: { type: Date, required: true },
    unitsSold: { type: Number, required: true }
}, { _id: false });

const inventorySchema = new mongoose.Schema({
    userId: { 
        type: String, 
        required: true,
        index: true
    },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    location: { type: String, default: 'Main-Warehouse' },
    horizonDays: { type: Number, default: 21 },
    onHand: { type: Number, default: 0 },
    inboundUnits: { type: Number, default: 0 },
    leadTimeDays: { type: Number, required: true },
    moq: { type: Number, required: true },
    unitCost: { type: Number, required: true },
    budgetCap: { type: Number, required: true },
    holdingCostPerUnit: { type: String, required: true },
    stockoutCostPerUnit: { type: String, required: true },
    safetyStockDays: { type: Number, default: 3 },
    targetServiceLevel: { type: Number, default: 0.95 },
    demandHistory: [demandHistorySchema],
    seasonalityHint: { type: String, default: 'Stable' },
    seasonalityMultiplier: { type: Number, default: 1 }
}, { timestamps: true });

module.exports = mongoose.model('Inventory', inventorySchema);