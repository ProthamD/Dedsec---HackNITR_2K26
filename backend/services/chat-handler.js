/**
 * Local Chat Handler Service
 * Handles chat messages without requiring Mastra/Inventree
 * Provides inventory-related responses using local data and logic
 */

const Inventory = require('../models/Inventory');

/**
 * Process a chat message and return an appropriate response
 * @param {string} message - User's chat message
 * @param {string} userId - User ID for context
 * @returns {Promise<{text: string, data?: any}>}
 */
async function handleChat(message, userId) {
    const lowerMessage = message.toLowerCase().trim();
    
    try {
        console.log(`Processing chat: "${message}" for user: ${userId}`);
        
        // Check for SKU queries (e.g., "tell me about suk-201", "sku-123", "item ABC-001")
        const skuMatch = message.match(/\b(sku|suk|item|product)[-\s]?([a-zA-Z0-9-]+)/i) 
                      || message.match(/\b([A-Z]{2,4}[-]?\d{2,5})\b/i);
        
        if (skuMatch) {
            const searchTerm = skuMatch[2] || skuMatch[1];
            console.log(`SKU query detected: ${searchTerm}`);
            return await handleSkuQuery(searchTerm, userId);
        }
        
        // Check for stock level queries
        if (lowerMessage.includes('stock') || lowerMessage.includes('inventory') || lowerMessage.includes('level')) {
            if (lowerMessage.includes('low') || lowerMessage.includes('restock') || lowerMessage.includes('out')) {
                return await handleLowStockQuery(userId);
            }
            if (lowerMessage.includes('high') || lowerMessage.includes('overstock') || lowerMessage.includes('excess')) {
                return await handleOverstockQuery(userId);
            }
            return await handleInventoryOverview(userId);
        }
        
        // Check for waste/expiry queries
        if (lowerMessage.includes('waste') || lowerMessage.includes('expir') || lowerMessage.includes('perishable')) {
            return await handleWasteQuery(userId);
        }
        
        // Check for action/automation queries
        if (lowerMessage.includes('action') || lowerMessage.includes('suggest') || lowerMessage.includes('recommend')) {
            return await handleActionSuggestions(userId);
        }
        
        // Check for help queries
        if (lowerMessage.includes('help') || lowerMessage.includes('what can you')) {
            return handleHelpQuery();
        }
        
        // Default: try to find relevant inventory items
        return await handleGeneralQuery(message, userId);
        
    } catch (error) {
        console.error('Chat handler error:', error);
        console.error('Stack trace:', error.stack);
        return {
            text: "I encountered an error processing your request. Please try again or rephrase your question.",
            error: error.message
        };
    }
}

async function handleSkuQuery(searchTerm, userId) {
    try {
        const query = userId && userId !== 'test' ? { userId } : {};
        
        console.log(`Searching for SKU with query:`, query, `searchTerm: ${searchTerm}`);
        
        // Search by SKU, name, or tags
        const items = await Inventory.find({
            ...query,
            $or: [
                { sku: { $regex: searchTerm, $options: 'i' } },
                { name: { $regex: searchTerm, $options: 'i' } },
                { tags: { $regex: searchTerm, $options: 'i' } }
            ]
        }).limit(5);
        
        console.log(`Found ${items.length} items`);
        
        if (items.length === 0) {
            return {
                text: `I couldn't find any items matching "${searchTerm}". Try searching with a different SKU or item name.`,
                data: { found: false, searchTerm }
            };
        }
    
    const item = items[0];
    const status = getStockStatus(item);
    const daysOfCover = item.demandForecast > 0 
        ? Math.round(item.onHand / item.demandForecast) 
        : 'N/A';
    
    let response = `**${item.name}** (SKU: ${item.sku})\n\n`;
    response += `📦 **Stock Level:** ${item.onHand} units (${status})\n`;
    response += `📊 **Reorder Point:** ${item.reorderPoint} units\n`;
    response += `📈 **Daily Demand:** ${item.demandForecast || 0} units\n`;
    response += `📅 **Days of Cover:** ${daysOfCover} days\n`;
    
    if (item.expiryDate) {
        const daysToExpiry = Math.ceil((new Date(item.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
        response += `⏰ **Expiry:** ${daysToExpiry > 0 ? `${daysToExpiry} days` : 'EXPIRED'}\n`;
    }
    
    if (item.tags && item.tags.length > 0) {
        response += `🏷️ **Tags:** ${item.tags.join(', ')}\n`;
    }
    
    // Add recommendations
    const recommendations = getItemRecommendations(item);
    if (recommendations.length > 0) {
        response += `\n💡 **Recommendations:**\n${recommendations.map(r => `• ${r}`).join('\n')}`;
    }
    
    console.log(`Returning SKU response for ${item.sku}`);
    
    return {
        text: response,
        data: { item, status, recommendations }
    };
    } catch (error) {
        console.error('handleSkuQuery error:', error);
        throw error;
    }
}

async function handleLowStockQuery(userId) {
    const query = userId ? { userId } : {};
    
    const lowStockItems = await Inventory.find({
        ...query,
        $expr: { $lte: ['$onHand', '$reorderPoint'] }
    }).sort({ onHand: 1 }).limit(10);
    
    if (lowStockItems.length === 0) {
        return {
            text: "✅ Great news! All items are above their reorder points. No immediate restocking needed.",
            data: { lowStockCount: 0 }
        };
    }
    
    let response = `⚠️ **${lowStockItems.length} items need restocking:**\n\n`;
    lowStockItems.forEach((item, i) => {
        response += `${i + 1}. **${item.name}** (${item.sku}): ${item.onHand}/${item.reorderPoint} units\n`;
    });
    
    response += `\n💡 Consider generating restock actions from the Management page.`;
    
    return {
        text: response,
        data: { lowStockItems, count: lowStockItems.length }
    };
}

async function handleOverstockQuery(userId) {
    const query = userId ? { userId } : {};
    
    const overstockItems = await Inventory.find({
        ...query,
        $expr: { $gt: ['$onHand', { $multiply: ['$reorderPoint', 3] }] }
    }).sort({ onHand: -1 }).limit(10);
    
    if (overstockItems.length === 0) {
        return {
            text: "✅ No significant overstock detected. Inventory levels look balanced.",
            data: { overstockCount: 0 }
        };
    }
    
    let response = `📦 **${overstockItems.length} items appear overstocked:**\n\n`;
    overstockItems.forEach((item, i) => {
        const excess = item.onHand - (item.reorderPoint * 2);
        response += `${i + 1}. **${item.name}** (${item.sku}): ${item.onHand} units (${excess} excess)\n`;
    });
    
    response += `\n💡 Visit the Reduce Waste page for optimization suggestions.`;
    
    return {
        text: response,
        data: { overstockItems, count: overstockItems.length }
    };
}

async function handleInventoryOverview(userId) {
    const query = userId ? { userId } : {};
    
    const allItems = await Inventory.find(query);
    const totalItems = allItems.length;
    const totalValue = allItems.reduce((sum, item) => sum + (item.onHand * (item.unitCost || 0)), 0);
    const lowStock = allItems.filter(item => item.onHand <= item.reorderPoint).length;
    const outOfStock = allItems.filter(item => item.onHand === 0).length;
    
    let response = `📊 **Inventory Overview:**\n\n`;
    response += `📦 **Total Items:** ${totalItems}\n`;
    response += `💰 **Total Value:** $${totalValue.toLocaleString()}\n`;
    response += `⚠️ **Low Stock:** ${lowStock} items\n`;
    response += `❌ **Out of Stock:** ${outOfStock} items\n`;
    
    if (lowStock > 0 || outOfStock > 0) {
        response += `\n💡 Use "show low stock" to see items needing attention.`;
    }
    
    return {
        text: response,
        data: { totalItems, totalValue, lowStock, outOfStock }
    };
}

async function handleWasteQuery(userId) {
    const query = userId ? { userId } : {};
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const expiringItems = await Inventory.find({
        ...query,
        expiryDate: { $lte: thirtyDays, $gte: now }
    }).sort({ expiryDate: 1 }).limit(10);
    
    const expiredItems = await Inventory.find({
        ...query,
        expiryDate: { $lt: now }
    }).limit(5);
    
    let response = `🗑️ **Waste & Expiry Report:**\n\n`;
    
    if (expiredItems.length > 0) {
        response += `❌ **${expiredItems.length} items have EXPIRED:**\n`;
        expiredItems.forEach(item => {
            response += `• ${item.name} (${item.sku}) - ${item.onHand} units\n`;
        });
        response += '\n';
    }
    
    if (expiringItems.length > 0) {
        response += `⚠️ **${expiringItems.length} items expiring within 30 days:**\n`;
        expiringItems.forEach(item => {
            const days = Math.ceil((new Date(item.expiryDate) - now) / (1000 * 60 * 60 * 24));
            response += `• ${item.name} (${item.sku}) - ${days} days, ${item.onHand} units\n`;
        });
    }
    
    if (expiredItems.length === 0 && expiringItems.length === 0) {
        response += `✅ No items expiring soon. Your inventory is in good shape!`;
    } else {
        response += `\n💡 Visit the Reduce Waste page for disposal and redistribution options.`;
    }
    
    return {
        text: response,
        data: { expiredItems, expiringItems }
    };
}

async function handleActionSuggestions(userId) {
    const query = userId ? { userId } : {};
    const items = await Inventory.find(query).limit(50);
    
    const suggestions = [];
    
    items.forEach(item => {
        if (item.onHand <= item.reorderPoint) {
            suggestions.push(`🔄 **Restock** ${item.name} - currently at ${item.onHand}/${item.reorderPoint}`);
        }
        if (item.onHand > item.reorderPoint * 3) {
            suggestions.push(`📉 **Reduce price** or bundle ${item.name} - ${item.onHand} units in stock`);
        }
        if (item.expiryDate) {
            const days = Math.ceil((new Date(item.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
            if (days <= 7 && days > 0) {
                suggestions.push(`⚡ **Urgent clearance** for ${item.name} - expires in ${days} days`);
            }
        }
    });
    
    if (suggestions.length === 0) {
        return {
            text: "✅ No urgent actions needed right now. Your inventory is well-managed!",
            data: { suggestions: [] }
        };
    }
    
    let response = `💡 **Suggested Actions (${Math.min(suggestions.length, 10)} of ${suggestions.length}):**\n\n`;
    response += suggestions.slice(0, 10).join('\n');
    response += `\n\n📋 Go to Management → Generate Actions for AI-powered recommendations.`;
    
    return {
        text: response,
        data: { suggestions, count: suggestions.length }
    };
}

async function handleGeneralQuery(message, userId) {
    const query = userId ? { userId } : {};
    
    // Try to find items matching any word in the message
    const words = message.split(/\s+/).filter(w => w.length > 2);
    const searchPattern = words.join('|');
    
    const items = await Inventory.find({
        ...query,
        $or: [
            { name: { $regex: searchPattern, $options: 'i' } },
            { sku: { $regex: searchPattern, $options: 'i' } },
            { tags: { $regex: searchPattern, $options: 'i' } }
        ]
    }).limit(5);
    
    if (items.length > 0) {
        let response = `I found ${items.length} item(s) that might be relevant:\n\n`;
        items.forEach((item, i) => {
            response += `${i + 1}. **${item.name}** (${item.sku}) - ${item.onHand} units\n`;
        });
        response += `\nAsk me about a specific SKU for more details!`;
        return { text: response, data: { items } };
    }
    
    return handleHelpQuery();
}

function handleHelpQuery() {
    return {
        text: `👋 **I'm your Inventory AI Assistant!** Here's what I can help with:\n
📦 **Stock Queries:**
• "Tell me about SKU-123" - Get item details
• "Show low stock items" - Find items needing restock
• "Show overstock" - Find excess inventory

🗑️ **Waste Management:**
• "Show expiring items" - View items near expiry
• "Waste report" - Get waste analysis

💡 **Actions & Suggestions:**
• "Suggest actions" - Get optimization tips
• "Inventory overview" - See summary stats

Just type naturally - I'll try to understand what you need!`,
        data: { type: 'help' }
    };
}

function getStockStatus(item) {
    if (item.onHand === 0) return '🔴 Out of Stock';
    if (item.onHand <= item.reorderPoint * 0.5) return '🔴 Critical';
    if (item.onHand <= item.reorderPoint) return '🟡 Low';
    if (item.onHand > item.reorderPoint * 3) return '🟣 Overstock';
    return '🟢 Normal';
}

function getItemRecommendations(item) {
    const recommendations = [];
    
    if (item.onHand === 0) {
        recommendations.push('Immediate restock required');
    } else if (item.onHand <= item.reorderPoint) {
        recommendations.push(`Restock soon - below reorder point of ${item.reorderPoint}`);
    }
    
    if (item.onHand > item.reorderPoint * 3) {
        recommendations.push('Consider price reduction or bundling to reduce excess stock');
    }
    
    if (item.expiryDate) {
        const days = Math.ceil((new Date(item.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
        if (days <= 0) {
            recommendations.push('EXPIRED - Remove from inventory and dispose properly');
        } else if (days <= 7) {
            recommendations.push(`Expires in ${days} days - Consider clearance sale`);
        } else if (days <= 30) {
            recommendations.push(`Expires in ${days} days - Monitor closely`);
        }
    }
    
    if (item.demandForecast > 0) {
        const daysOfCover = item.onHand / item.demandForecast;
        if (daysOfCover < 7) {
            recommendations.push(`Only ${Math.round(daysOfCover)} days of stock remaining at current demand`);
        }
    }
    
    return recommendations;
}

module.exports = { handleChat };
