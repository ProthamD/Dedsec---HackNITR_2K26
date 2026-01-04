const mongoose = require("mongoose");

const actionSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    type: {
        type: String,
        required: true,
        enum: [
            'RESTOCK',
            'TRANSFER',
            'ORDER',
            'OPTIMIZE',
            'REDUCE_STOCK',
            'EMERGENCY_ORDER',
            'NETWORK_REQUEST',
            'OFFER_TRUCK'
        ]
    },
    priority: {
        type: String,
        required: true,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        default: 'MEDIUM'
    },
    status: {
        type: String,
        required: true,
        enum: ['PENDING', 'APPROVED', 'REJECTED', 'EXECUTED'],
        default: 'PENDING'
    },
    productSku: {
        type: String,
        required: true
    },
    productName: {
        type: String,
        required: true
    },
    currentStock: {
        type: Number,
        required: true
    },
    suggestedQuantity: {
        type: Number,
        required: true
    },
    fromWarehouse: {
        type: String
    },
    toWarehouse: {
        type: String
    },
    reasoning: {
        type: String,
        required: true
    },
    metrics: {
        stockoutRisk: Number,
        daysOfCover: Number,
        demandTrend: String,
        costImpact: Number,
        urgencyScore: Number
    },
    aiConfidence: {
        type: Number,
        min: 0,
        max: 100,
        default: 75
    },
    estimatedCost: {
        type: Number,
        default: 0
    },
    estimatedSavings: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    approvedAt: {
        type: Date
    },
    approvedBy: {
        type: String
    },
    executedAt: {
        type: Date
    },
    notes: {
        type: String
    }
});

// Index for efficient queries
actionSchema.index({ userId: 1, status: 1, priority: 1 });
actionSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Action", actionSchema);
