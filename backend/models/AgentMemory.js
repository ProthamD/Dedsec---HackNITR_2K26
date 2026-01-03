const mongoose = require('mongoose');

const AgentMemorySchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    agentType: {
        type: String,
        required: true,
        enum: ['inventory', 'waste-reduction', 'distribution', 'disaster-analysis'],
        index: true
    },
    decision: {
        type: String,
        required: true
    },
    context: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    action: {
        type: String,
        required: true
    },
    outcome: {
        type: String,
        required: true,
        enum: ['success', 'failure', 'partial', 'pending']
    },
    metrics: {
        cost: Number,
        timeElapsed: Number,
        accuracy: Number,
        userSatisfaction: Number,
        inventoryImpact: Number
    },
    learnings: {
        type: String
    },
    tags: [{
        type: String,
        index: true
    }],
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Index for efficient querying
AgentMemorySchema.index({ userId: 1, agentType: 1, outcome: 1 });
AgentMemorySchema.index({ tags: 1 });

module.exports = mongoose.model('AgentMemory', AgentMemorySchema);
