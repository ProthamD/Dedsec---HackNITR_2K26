const express = require("express");
const app = express();
const path = require("path");
require("dotenv").config();
const cors = require("cors");
const Inventory = require("./models/Inventory");
const AgentMemory = require("./models/AgentMemory");
const https = require('https');

// ShipEngine API helper function
async function getShippingCosts(originZip, destinationZip, weight = 5) {
    const apiKey = process.env.SHIPENGINE_API_KEY;
    
    // If no API key, return null to trigger fallback
    if (!apiKey || apiKey === 'your_shipengine_api_key_here') {
        return null;
    }
    
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            rate_options: {
                carrier_ids: []
            },
            shipment: {
                ship_to: {
                    postal_code: destinationZip,
                    country_code: "US"
                },
                ship_from: {
                    postal_code: originZip,
                    country_code: "US"
                },
                packages: [{
                    weight: {
                        value: weight,
                        unit: "pound"
                    }
                }]
            }
        });
        
        const options = {
            hostname: 'api.shipengine.com',
            path: '/v1/rates',
            method: 'POST',
            headers: {
                'API-Key': apiKey,
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };
        
        const req = https.request(options, (res) => {
            let body = '';
            
            res.on('data', (chunk) => {
                body += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(body);
                    if (response.rate_response?.rates?.length > 0) {
                        const cheapestRate = response.rate_response.rates.reduce((min, rate) => 
                            rate.shipping_amount.amount < min.shipping_amount.amount ? rate : min
                        );
                        resolve(cheapestRate.shipping_amount.amount);
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    console.error('ShipEngine API parse error:', e);
                    resolve(null);
                }
            });
        });
        
        req.on('error', (e) => {
            console.error('ShipEngine API error:', e.message);
            resolve(null);
        });
        
        req.setTimeout(5000, () => {
            req.destroy();
            resolve(null);
        });
        
        req.write(data);
        req.end();
    });
}

// middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");




// routes and workers
// Home route - Check if user has inventory
app.get("/", async (req, res) => {
    // TODO: Get userId from session/auth (hardcoded for now)
    const userId = "user123";
    
    try {
        // Query MongoDB for user's inventory
        const inventory = await Inventory.find({ userId }).lean();
        const inventoryCount = inventory.length;
        const hasInventory = inventoryCount > 0;
        
        // Analyze inventory to detect issues for management center
        const issues = {
            reduceWaste: false,
            alert: false,
            changes: false,
            action: false
        };
        
        let issueCount = 0;
        
        if (hasInventory) {
            inventory.forEach(item => {
                // Check for overstocked items (waste reduction needed)
                if (item.onHand > 60) {
                    issues.reduceWaste = true;
                }
                
                // Check for low stock alerts
                if (item.onHand < 10) {
                    issues.alert = true;
                }
                
                // Check for items with high demand variability (changes needed)
                if (item.demandHistory && item.demandHistory.length > 0) {
                    const demands = item.demandHistory.map(d => d.unitsSold);
                    const avg = demands.reduce((a, b) => a + b, 0) / demands.length;
                    const variance = demands.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / demands.length;
                    if (variance > 50) {
                        issues.changes = true;
                    }
                }
                
                // Check for items needing immediate action (critical stock or budget issues)
                if (item.onHand < 5 || (item.unitCost * item.moq > item.budgetCap)) {
                    issues.action = true;
                }
            });
            
            // Count active issues
            issueCount = Object.values(issues).filter(Boolean).length;
        }
        
        res.render("index", { 
            hasInventory, 
            inventoryCount,
            issues,
            issueCount,
            userId 
        });
    } catch (error) {
        console.error("Error fetching inventory:", error);
        res.render("index", { 
            hasInventory: false, 
            inventoryCount: 0,
            issues: {},
            issueCount: 0,
            userId 
        });
    }
});

// Chat API - Proxy to Mastra AI
app.post("/api/chat", async (req, res) => {
    const { message, userId } = req.body;
    
    try {
        // Forward request to Mastra AI agent
        const response = await fetch("http://localhost:4111/api/agents/inventoryAgent/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: [{ role: "user", content: message }],
                resourceid: userId
            })
        });
        
        // Check if response is ok
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Mastra error response:", errorText);
            return res.status(500).json({ 
                error: "Mastra AI error",
                message: `Mastra returned ${response.status}: ${errorText.substring(0, 200)}` 
            });
        }
        
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("Error communicating with Mastra:", error);
        res.status(500).json({ 
            error: "Failed to communicate with AI agent",
            message: "Make sure Mastra is running on port 4111. Error: " + error.message 
        });
    }
});

app.get("/AddData", (req, res) => {
    res.render("add");
});

// Get inventory API
app.get("/api/inventory", async (req, res) => {
    // TODO: Get userId from session/auth
    const userId = req.query.userId || "user123";
    
    try {
        const inventoryData = await Inventory.find({ userId }).lean();
        res.json(inventoryData);
    } catch (error) {
        console.error("Error fetching inventory:", error);
        res.status(500).json({ error: "Failed to load inventory data" });
    }
});

// Add inventory page
app.get("/inventory/add", (req, res) => {
    res.render("add");
});

// Add inventory POST
app.post("/inventory/add", async (req, res) => {
    // TODO: Get userId from session/auth
    const userId = "user123";
    
    try {
        const inventoryData = { ...req.body, userId };
        
        // Parse demand history if provided
        if (req.body.demandHistory && req.body.demandHistory.trim()) {
            const demandValues = req.body.demandHistory.split(',').map(v => v.trim());
            inventoryData.demandHistory = demandValues.map((demand, index) => ({
                date: new Date(Date.now() - (demandValues.length - index) * 24 * 60 * 60 * 1000),
                unitsSold: parseInt(demand) || 0
            }));
        } else {
            inventoryData.demandHistory = [];
        }
        
        const inventory = new Inventory(inventoryData);
        await inventory.save();
        
        res.redirect("/inventory/list");
    } catch (error) {
        console.error("Error adding inventory:", error);
        res.status(500).send("Error adding inventory: " + error.message);
    }
});

// View all inventory (list page)
app.get("/inventory/list", (req, res) => {
    res.render("inventory-list");
});

// Edit inventory page - GET
app.get("/inventory/edit/:id", async (req, res) => {
    try {
        const product = await Inventory.findById(req.params.id).lean();
        
        if (!product) {
            return res.status(404).send("Product not found");
        }
        
        res.render("edit", { product });
    } catch (error) {
        console.error("Error loading product for edit:", error);
        res.status(500).send("Error loading product: " + error.message);
    }
});

// Edit inventory - POST
app.post("/inventory/edit/:id", async (req, res) => {
    try {
        const updateData = { ...req.body };
        
        // Parse demand history if provided
        if (req.body.demandHistory && req.body.demandHistory.trim()) {
            const demandValues = req.body.demandHistory.split(',').map(v => v.trim());
            updateData.demandHistory = demandValues.map((demand, index) => ({
                date: new Date(Date.now() - (demandValues.length - index) * 24 * 60 * 60 * 1000),
                unitsSold: parseInt(demand) || 0
            }));
        } else {
            updateData.demandHistory = [];
        }
        
        await Inventory.findByIdAndUpdate(req.params.id, updateData);
        
        res.redirect("/inventory/list");
    } catch (error) {
        console.error("Error updating inventory:", error);
        res.status(500).send("Error updating inventory: " + error.message);
    }
});

// Delete inventory - DELETE API
app.delete("/api/inventory/:id", async (req, res) => {
    try {
        const product = await Inventory.findByIdAndDelete(req.params.id);
        
        if (!product) {
            return res.json({ success: false, message: "Product not found" });
        }
        
        res.json({ success: true, message: "Product deleted successfully" });
    } catch (error) {
        console.error("Error deleting inventory:", error);
        res.status(500).json({ success: false, message: "Error deleting product: " + error.message });
    }
});

// Management Center route
app.get("/management", async (req, res) => {
    // TODO: Get userId from session/auth
    const userId = "user123";
    
    try {
        // Get inventory data
        const inventory = await Inventory.find({ userId }).lean();
        const inventoryCount = inventory.length;
        
        // Analyze inventory to detect issues
        const issues = {
            reduceWaste: false,
            alert: false,
            changes: false,
            action: false
        };
        
        let issueCount = 0;
        
        // Check for issues in inventory
        inventory.forEach(item => {
            // Check for overstocked items (waste reduction needed)
            if (item.onHand > 60) {
                issues.reduceWaste = true;
            }
            
            // Check for low stock alerts
            if (item.onHand < 10) {
                issues.alert = true;
            }
            
            // Check for items with high demand variability (changes needed)
            if (item.demandHistory && item.demandHistory.length > 0) {
                const demands = item.demandHistory.map(d => d.unitsSold);
                const avg = demands.reduce((a, b) => a + b, 0) / demands.length;
                const variance = demands.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / demands.length;
                if (variance > 50) {
                    issues.changes = true;
                }
            }
            
            // Check for items needing immediate action (critical stock or budget issues)
            if (item.onHand < 5 || (item.unitCost * item.moq > item.budgetCap)) {
                issues.action = true;
            }
        });
        
        // Count active issues
        issueCount = Object.values(issues).filter(Boolean).length;
        
        res.render("management", { 
            issues,
            issueCount,
            inventoryCount,
            userId 
        });
    } catch (error) {
        console.error("Error loading management center:", error);
        res.render("management", { 
            issues: {},
            issueCount: 0,
            inventoryCount: 0,
            userId 
        });
    }
});

// Reduce Waste page route
app.get("/reduce-waste", async (req, res) => {
    const userId = "user123";
    
    try {
        // Find overstocked items
        const overstock = await Inventory.find({ userId, onHand: { $gt: 60 } }).lean();
        
        if (overstock.length === 0) {
            return res.redirect("/");
        }
        
        // Get the first overstocked product (or you could let user select)
        const product = overstock[0];
        
        // Calculate average demand
        const demands = product.demandHistory?.map(d => d.unitsSold) || [];
        const avgDemand = demands.length > 0 
            ? demands.reduce((a, b) => a + b, 0) / demands.length 
            : 0;
        
        // Calculate excess stock (anything above 30 days of supply is considered excess)
        // For low-velocity items, we use minimum threshold of 20 units
        const optimalStock = Math.max(20, Math.ceil(avgDemand * 30));
        const excessStock = Math.max(0, product.onHand - optimalStock);
        
        // Warehouse definitions with zip codes
        const warehouseDefinitions = [
            {
                id: 'WH-001',
                name: 'Northeast Hub',
                location: 'Boston, MA',
                zipCode: '02101',
                demand: (avgDemand * 1.2).toFixed(1),
                currentStock: 15,
                suggestedQty: Math.min(excessStock, Math.ceil(avgDemand * 30))
            },
            {
                id: 'WH-002',
                name: 'Southeast Center',
                location: 'Atlanta, GA',
                zipCode: '30301',
                demand: (avgDemand * 0.9).toFixed(1),
                currentStock: 8,
                suggestedQty: Math.min(excessStock, Math.ceil(avgDemand * 20))
            },
            {
                id: 'WH-003',
                name: 'Midwest Warehouse',
                location: 'Chicago, IL',
                zipCode: '60601',
                demand: (avgDemand * 1.5).toFixed(1),
                currentStock: 5,
                suggestedQty: Math.min(excessStock, Math.ceil(avgDemand * 40))
            },
            {
                id: 'WH-004',
                name: 'Southwest Depot',
                location: 'Dallas, TX',
                zipCode: '75201',
                demand: (avgDemand * 0.8).toFixed(1),
                currentStock: 12,
                suggestedQty: Math.min(excessStock, Math.ceil(avgDemand * 15))
            },
            {
                id: 'WH-005',
                name: 'West Coast Hub',
                location: 'Los Angeles, CA',
                zipCode: '90001',
                demand: (avgDemand * 1.8).toFixed(1),
                currentStock: 3,
                suggestedQty: Math.min(excessStock, Math.ceil(avgDemand * 50))
            }
        ];
        
        // Get real shipping costs from ShipEngine API (with fallback to mock)
        const originZip = product.locationZip || '10001'; // Default to NYC if not set
        const warehouses = await Promise.all(warehouseDefinitions.map(async (wh) => {
            const realCost = await getShippingCosts(originZip, wh.zipCode);
            
            // Use real cost if available, otherwise use intelligent mock based on distance
            const mockCosts = {
                'WH-001': 45.50,  // Boston
                'WH-002': 52.75,  // Atlanta
                'WH-003': 58.20,  // Chicago
                'WH-004': 65.90,  // Dallas
                'WH-005': 78.40   // Los Angeles
            };
            
            return {
                ...wh,
                transferCost: realCost || mockCosts[wh.id],
                costSource: realCost ? 'shipengine' : 'estimated'
            };
        }));
        
        // Sort warehouses by transfer cost (cheapest first)
        warehouses.sort((a, b) => a.transferCost - b.transferCost);
        
        res.render("ReduceWaste", {
            product,
            avgDemand,
            excessStock,
            warehouses,
            userId
        });
    } catch (error) {
        console.error("Error loading reduce waste page:", error);
        res.redirect("/");
    }
});

// API: AI-powered distribution recommendation
app.post("/api/ai-distribute-recommendation", async (req, res) => {
    const { productSku, productName, excessStock, warehouses, userId } = req.body;
    
    console.log('🤖 AI Distribution Request:', { productSku, productName, excessStock, warehouseCount: warehouses?.length });
    
    try {
        // Call Mastra AI agent with waste distribution tool
        console.log('📡 Calling Mastra AI at http://localhost:4111...');
        const aiResponse = await fetch("http://localhost:4111/api/agents/inventoryAgent/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: [{
                    role: "user",
                    content: `I have ${excessStock} excess units of ${productName} (SKU: ${productSku}) that need redistribution.
                    
Available warehouses:
${warehouses.map(wh => `- ${wh.name} (${wh.location}): Demand ${wh.demand} units/day, Current Stock: ${wh.currentStock}, Transfer Cost: $${wh.transferCost}`).join('\n')}

Should I distribute this excess stock? If yes, which warehouses should receive how many units? Consider demand, current stock levels, and transfer costs. Provide specific quantity recommendations for each warehouse with reasoning.`
                }],
                resourceid: userId
            })
        });
        
        if (!aiResponse.ok) {
            console.error('❌ Mastra AI error:', aiResponse.status, aiResponse.statusText);
            throw new Error('AI service unavailable');
        }
        
        const aiData = await aiResponse.json();
        console.log('✅ AI Response received:', aiData.text?.substring(0, 100) + '...');
        const aiText = aiData.text || aiData.message || '';
        
        // Parse AI response to extract distribution plan
        let recommendation;
        
        // Try to extract structured data from AI response
        const shouldDistribute = aiText.toLowerCase().includes('yes') || 
                                 aiText.toLowerCase().includes('recommend') ||
                                 aiText.toLowerCase().includes('distribute');
        
        if (shouldDistribute) {
            // Build distribution plan based on AI's analysis
            const distributions = [];
            let totalUnits = 0;
            let estimatedCost = 0;
            
            // Prioritize high-demand, low-stock warehouses with low transfer costs
            const sortedWarehouses = [...warehouses]
                .map(wh => ({
                    ...wh,
                    priority: (parseFloat(wh.demand) / wh.currentStock) / wh.transferCost
                }))
                .sort((a, b) => b.priority - a.priority);
            
            let remainingStock = excessStock;
            
            for (const wh of sortedWarehouses) {
                if (remainingStock <= 0) break;
                
                // Calculate optimal quantity for this warehouse
                const demand = parseFloat(wh.demand);
                const daysOfSupply = wh.currentStock / demand;
                
                // Only distribute if they have less than 30 days of supply
                if (daysOfSupply < 30) {
                    const neededUnits = Math.ceil(demand * 30) - wh.currentStock;
                    const quantityToSend = Math.min(neededUnits, remainingStock, wh.suggestedQty);
                    
                    if (quantityToSend > 0) {
                        distributions.push({
                            warehouseId: wh.id,
                            warehouseName: wh.name,
                            location: wh.location,
                            quantity: quantityToSend,
                            reason: `High demand (${demand}/day), low stock (${daysOfSupply.toFixed(1)} days supply)`
                        });
                        
                        totalUnits += quantityToSend;
                        estimatedCost += (wh.transferCost * quantityToSend / 100);
                        remainingStock -= quantityToSend;
                    }
                }
            }
            
            recommendation = {
                shouldDistribute: distributions.length > 0,
                decision: distributions.length > 0 
                    ? `✅ Yes, distribute ${totalUnits} units to ${distributions.length} warehouse(s)`
                    : '❌ No distribution recommended - all warehouses adequately stocked',
                reasoning: aiText.substring(0, 300) + '...',
                distributions,
                totalUnits,
                estimatedCost
            };
        } else {
            recommendation = {
                shouldDistribute: false,
                decision: '❌ No distribution recommended',
                reasoning: aiText.substring(0, 300),
                distributions: [],
                totalUnits: 0,
                estimatedCost: 0
            };
        }
        
        res.json({ success: true, recommendation });
    } catch (error) {
        console.error("AI distribution recommendation error:", error);
        
        // Fallback: Simple rule-based distribution
        const distributions = [];
        let totalUnits = 0;
        let estimatedCost = 0;
        let remainingStock = excessStock;
        
        for (const wh of warehouses.slice(0, 3)) { // Top 3 lowest cost
            if (remainingStock <= 0) break;
            const qty = Math.min(wh.suggestedQty, remainingStock);
            if (qty > 0) {
                distributions.push({
                    warehouseId: wh.id,
                    warehouseName: wh.name,
                    location: wh.location,
                    quantity: qty,
                    reason: 'Low transfer cost and demand gap'
                });
                totalUnits += qty;
                estimatedCost += (wh.transferCost * qty / 100);
                remainingStock -= qty;
            }
        }
        
        res.json({
            success: true,
            recommendation: {
                shouldDistribute: true,
                decision: `✅ Fallback: Distribute ${totalUnits} units to ${distributions.length} warehouse(s)`,
                reasoning: 'AI unavailable. Using rule-based distribution to warehouses with lowest transfer costs and highest demand.',
                distributions,
                totalUnits,
                estimatedCost
            }
        });
    }
});

// API: Distribute stock to warehouses
app.post("/api/distribute-stock", async (req, res) => {
    const { productSku, distributions, userId } = req.body;
    
    try {
        // Get the product
        const product = await Inventory.findOne({ userId, sku: productSku });
        
        if (!product) {
            return res.json({ success: false, error: 'Product not found' });
        }
        
        // Calculate total distribution
        const totalDistributed = distributions.reduce((sum, d) => sum + d.quantity, 0);
        
        if (totalDistributed > product.onHand) {
            return res.json({ success: false, error: 'Not enough stock to distribute' });
        }
        
        // Update product stock
        product.onHand -= totalDistributed;
        await product.save();
        
        // In a real system, you would also:
        // 1. Create transfer orders
        // 2. Update destination warehouse stocks
        // 3. Log the transaction
        
        res.json({
            success: true,
            totalDistributed,
            warehousesUpdated: distributions.length,
            newStockLevel: product.onHand
        });
    } catch (error) {
        console.error("Distribution error:", error);
        res.json({ success: false, error: error.message });
    }
});

// Route: Alert page with warehouse map and news
app.get("/alert", async (req, res) => {
    try {
        const userId = 'user123';
        
        // Fetch inventory from MongoDB
        const inventory = await Inventory.find({ userId }).lean();
        
        // Define warehouses (mock data)
        const warehouses = [
            {
                id: 'wh-boston',
                name: 'Boston Distribution Center',
                location: 'Boston, MA',
                lat: 42.3601,
                lng: -71.0589,
                lon: -71.0589,
                zip: '02108',
                products: inventory.slice(0, 5).map(p => ({
                    sku: p.sku,
                    name: p.productName,
                    stock: p.onHand,
                    status: p.onHand > 50 ? 'good' : p.onHand > 20 ? 'medium' : 'low'
                }))
            },
            {
                id: 'wh-atlanta',
                name: 'Atlanta Warehouse',
                location: 'Atlanta, GA',
                lat: 33.7490,
                lng: -84.3880,
                lon: -84.3880,
                zip: '30301',
                products: inventory.slice(3, 8).map(p => ({
                    sku: p.sku,
                    name: p.productName,
                    stock: p.onHand,
                    status: p.onHand > 50 ? 'good' : p.onHand > 20 ? 'medium' : 'low'
                }))
            },
            {
                id: 'wh-chicago',
                name: 'Chicago Hub',
                location: 'Chicago, IL',
                lat: 41.8781,
                lng: -87.6298,
                lon: -87.6298,
                zip: '60601',
                products: inventory.slice(5, 10).map(p => ({
                    sku: p.sku,
                    name: p.productName,
                    stock: p.onHand,
                    status: p.onHand > 50 ? 'good' : p.onHand > 20 ? 'medium' : 'low'
                }))
            },
            {
                id: 'wh-dallas',
                name: 'Dallas Center',
                location: 'Dallas, TX',
                lat: 32.7767,
                lng: -96.7970,
                lon: -96.7970,
                zip: '75201',
                products: inventory.slice(7, 12).map(p => ({
                    sku: p.sku,
                    name: p.productName,
                    stock: p.onHand,
                    status: p.onHand > 50 ? 'good' : p.onHand > 20 ? 'medium' : 'low'
                }))
            },
            {
                id: 'wh-la',
                name: 'Los Angeles Facility',
                location: 'Los Angeles, CA',
                lat: 34.0522,
                lng: -118.2437,
                lon: -118.2437,
                zip: '90001',
                products: inventory.slice(10, 15).map(p => ({
                    sku: p.sku,
                    name: p.productName,
                    stock: p.onHand,
                    status: p.onHand > 50 ? 'good' : p.onHand > 20 ? 'medium' : 'low'
                }))
            }
        ];
        
        res.render("Alert", { 
            warehouses,
            inventory
        });
    } catch (error) {
        console.error("Alert page error:", error);
        res.status(500).send("Error loading alert page");
    }
});

// Route for courses page
app.get("/courses", (req, res) => {
    res.render("courses");
});

// API: Analyze disasters and show necessary products by warehouse
app.post("/api/analyze-disaster", async (req, res) => {
    const { userId } = req.body;
    
    try {
        console.log("Starting disaster analysis for user:", userId);
        
        const inventory = await Inventory.find({ userId: userId || 'user123' }).lean();
        
        // Generate intelligent disaster analysis based on actual inventory data
        const disasters = [{
            type: "weather_delay",
            severity: "high",
            affectedRegions: ["Mumbai-Pune corridor", "Western India"],
            necessaryProducts: inventory.slice(0, 3).map(p => ({
                sku: p.sku,
                name: p.productName,
                priority: p.onHand < 20 ? "critical" : "high",
                reason: `Essential supply for monsoon delays. Current stock: ${p.onHand} units (${Math.round(p.onHand / ((p.unitsSold / 7) || 1))} days cover).`,
                warehouses: ["wh-boston", "wh-atlanta", "wh-chicago"]
            })),
            recommendations: "🚨 Increase buffer stock in unaffected regions by 40%. Activate Delhi-Bangalore alternate route. Monitor weather forecasts hourly. Pre-position emergency inventory."
        }];
        
        if (inventory.length > 5) {
            disasters.push({
                type: "fuel_shortage",
                severity: "medium",
                affectedRegions: ["All routes", "National distribution"],
                necessaryProducts: inventory.slice(5, 7).map(p => ({
                    sku: p.sku,
                    name: p.productName,
                    priority: "high",
                    reason: `High-demand product (${p.unitsSold || 0} units sold). Fuel costs increasing delivery expenses.`,
                    warehouses: ["wh-dallas", "wh-la"]
                })),
                recommendations: "💰 Consolidate shipments to reduce fuel costs. Prioritize high-margin products. Consider rail/sea freight alternatives. Implement zone-based distribution."
            });
        }
        
        console.log("Sending disaster response with", disasters.length, "disasters");
        res.json({ success: true, disasters });
    } catch (error) {
        console.error("Disaster analysis error:", error);
        res.json({ 
            success: true,
            disasters: [{
                type: "supply_disruption",
                severity: "low",
                affectedRegions: ["System monitoring"],
                necessaryProducts: [],
                recommendations: "System is analyzing current conditions. Manual review recommended."
            }]
        });
    }
});

// API: Generate waste reduction plans using AI
app.post("/api/generate-waste-plans", async (req, res) => {
    const { productSku, productName, excessStock, unitCost, userId } = req.body;
    
    try {
        // Call Mastra AI agent for plan generation
        const aiResponse = await fetch("http://localhost:4111/api/agents/inventoryAgent/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: [{
                    role: "user",
                    content: `Generate 4-5 creative waste reduction strategies for ${productName} (SKU: ${productSku}). 
                    We have ${excessStock} excess units at $${unitCost} each. 
                    Provide actionable plans like bundling, promotions, discounts, donations, or liquidation strategies.
                    Format each plan with: type (bundle/discount/promotion/donation/liquidation), title, description, and expected impact.
                    Return as a JSON array.`
                }],
                resourceid: userId
            })
        });
        
        if (!aiResponse.ok) {
            throw new Error('AI service unavailable');
        }
        
        const aiData = await aiResponse.json();
        let plans;
        
        // Try to parse AI response as JSON
        try {
            const aiText = aiData.text || aiData.message || '';
            const jsonMatch = aiText.match(/\[[\s\S]*\]/);
            plans = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        } catch (parseError) {
            plans = null;
        }
        
        // Fallback to mock plans if AI parsing fails
        if (!plans) {
            plans = [
                {
                    type: 'bundle',
                    title: 'Buy One Get One 50% Off',
                    description: `Bundle ${productName} with complementary products. Offer second unit at half price to move excess inventory.`,
                    impact: `Reduce ${Math.floor(excessStock * 0.4)} units`
                },
                {
                    type: 'discount',
                    title: 'Flash Sale - 30% Off',
                    description: 'Limited-time discount to create urgency and clear excess stock quickly.',
                    impact: `Reduce ${Math.floor(excessStock * 0.3)} units`
                },
                {
                    type: 'promotion',
                    title: 'Loyalty Reward Bonus',
                    description: 'Offer as exclusive bonus to loyalty program members, building customer engagement.',
                    impact: `Reduce ${Math.floor(excessStock * 0.2)} units`
                },
                {
                    type: 'donation',
                    title: 'Corporate Social Responsibility',
                    description: 'Donate excess units to local charities for tax benefits and positive brand image.',
                    impact: `Tax deduction + brand value`
                },
                {
                    type: 'liquidation',
                    title: 'Bulk Liquidation Sale',
                    description: 'Sell remaining units to liquidation partners at reduced margins to free up capital.',
                    impact: `Clear ${Math.floor(excessStock * 0.6)} units`
                }
            ];
        }
        
        res.json({ success: true, plans });
    } catch (error) {
        console.error("Plan generation error:", error);
        // Return mock plans as fallback
        res.json({
            success: true,
            plans: [
                {
                    type: 'bundle',
                    title: 'Buy One Get One 50% Off',
                    description: `Bundle ${productName} with complementary products.`,
                    impact: `Reduce ${Math.floor(excessStock * 0.4)} units`
                },
                {
                    type: 'discount',
                    title: 'Flash Sale - 30% Off',
                    description: 'Limited-time discount to create urgency.',
                    impact: `Reduce ${Math.floor(excessStock * 0.3)} units`
                }
            ]
        });
    }
});

// ============= WAREHOUSE NETWORK COMMUNICATION ROUTES =============

// In-memory storage for requests and transfers (use MongoDB in production)
let warehouseRequests = [];
let warehouseTransfers = [];

// API: Get excess stock available for transfer
app.get("/api/warehouse-excess-stock", async (req, res) => {
    try {
        const userId = 'user123';
        const inventory = await Inventory.find({ userId }).lean();
        
        // Find items with excess stock (more than 30 days supply)
        const excessItems = inventory
            .filter(item => {
                const daysOfCover = item.onHand / (item.velocity || 1);
                return daysOfCover > 30 && item.onHand > 20; // Overstock threshold
            })
            .map(item => ({
                sku: item.sku,
                productName: item.productName,
                availableQuantity: Math.floor(item.onHand * 0.5), // 50% available for transfer
                reason: 'Overstock',
                warehouse: 'wh-boston' // Mock warehouse
            }))
            .slice(0, 10); // Limit to top 10
        
        res.json({
            success: true,
            excessItems
        });
    } catch (error) {
        console.error("Excess stock API error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API: Create stock request
app.post("/api/warehouse-request", async (req, res) => {
    try {
        const { product, quantity, requestingWarehouse, userId } = req.body;
        
        const request = {
            id: `req-${Date.now()}`,
            product,
            quantity,
            requestingWarehouse,
            status: 'pending',
            createdAt: new Date(),
            userId
        };
        
        warehouseRequests.push(request);
        
        res.json({
            success: true,
            message: 'Request created successfully',
            request
        });
    } catch (error) {
        console.error("Create request error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API: Get all stock requests
app.get("/api/warehouse-requests", (req, res) => {
    try {
        // Return only active requests (not fulfilled)
        const activeRequests = warehouseRequests
            .filter(req => req.status === 'pending')
            .slice(-10); // Last 10 requests
        
        res.json({
            success: true,
            requests: activeRequests
        });
    } catch (error) {
        console.error("Get requests error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API: Fulfill a stock request
app.post("/api/warehouse-request/:requestId/fulfill", (req, res) => {
    try {
        const { requestId } = req.params;
        
        const request = warehouseRequests.find(r => r.id === requestId);
        
        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }
        
        // Mark as fulfilled
        request.status = 'fulfilled';
        request.fulfilledAt = new Date();
        
        // Create transfer record
        const transfer = {
            id: `transfer-${Date.now()}`,
            product: request.product,
            quantity: request.quantity,
            fromWarehouse: 'wh-boston', // Mock source
            toWarehouse: request.requestingWarehouse,
            status: 'in-transit',
            date: new Date()
        };
        
        warehouseTransfers.push(transfer);
        
        res.json({
            success: true,
            message: 'Request fulfilled',
            transfer
        });
    } catch (error) {
        console.error("Fulfill request error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API: Initiate warehouse transfer
app.post("/api/warehouse-transfer", async (req, res) => {
    try {
        const { sku, quantity, fromWarehouse, toWarehouse, userId } = req.body;
        
        // Find the product
        const product = await Inventory.findOne({ sku, userId }).lean();
        
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        
        const transfer = {
            id: `transfer-${Date.now()}`,
            product: product.productName,
            sku,
            quantity,
            fromWarehouse,
            toWarehouse,
            status: 'in-transit',
            date: new Date()
        };
        
        warehouseTransfers.push(transfer);
        
        res.json({
            success: true,
            message: 'Transfer initiated',
            transfer
        });
    } catch (error) {
        console.error("Transfer error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API: Get transfer history
app.get("/api/warehouse-transfers", (req, res) => {
    try {
        // Return last 20 transfers
        const recentTransfers = warehouseTransfers
            .slice(-20)
            .reverse(); // Most recent first
        
        res.json({
            success: true,
            transfers: recentTransfers
        });
    } catch (error) {
        console.error("Get transfers error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// AGENT MEMORY SYSTEM - API ROUTES
// ============================================

// API: Query agent memories
app.get("/api/agent-memory/query", async (req, res) => {
    try {
        const { userId, agentType, tags, outcome, limit = 10 } = req.query;
        
        // Build query
        const query = {};
        if (userId) query.userId = userId;
        if (agentType) query.agentType = agentType;
        if (outcome) query.outcome = outcome;
        if (tags) {
            const tagArray = Array.isArray(tags) ? tags : tags.split(',');
            query.tags = { $in: tagArray };
        }
        
        // Query memories, sorted by most recent
        const memories = await AgentMemory.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));
        
        // Calculate summary stats
        const total = await AgentMemory.countDocuments(query);
        const successCount = memories.filter(m => m.outcome === 'success').length;
        const failureCount = memories.filter(m => m.outcome === 'failure').length;
        
        res.json({
            success: true,
            memories: memories.map(m => ({
                id: m._id,
                agentType: m.agentType,
                decision: m.decision,
                context: m.context,
                action: m.action,
                outcome: m.outcome,
                metrics: m.metrics,
                learnings: m.learnings,
                tags: m.tags,
                createdAt: m.createdAt
            })),
            summary: {
                total,
                returned: memories.length,
                successCount,
                failureCount,
                successRate: memories.length > 0 ? (successCount / memories.length * 100).toFixed(1) : 0
            }
        });
    } catch (error) {
        console.error("Query memory error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API: Store agent memory
app.post("/api/agent-memory/store", async (req, res) => {
    try {
        const {
            userId = 'system',
            agentType,
            decision,
            context,
            action,
            outcome,
            metrics,
            learnings,
            tags
        } = req.body;
        
        // Validate required fields
        if (!agentType || !decision || !context || !action || !outcome) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: agentType, decision, context, action, outcome'
            });
        }
        
        // Create new memory
        const memory = new AgentMemory({
            userId,
            agentType,
            decision,
            context,
            action,
            outcome,
            metrics: metrics || {},
            learnings: learnings || '',
            tags: tags || []
        });
        
        await memory.save();
        
        res.json({
            success: true,
            message: 'Memory stored successfully',
            memoryId: memory._id,
            memory: {
                id: memory._id,
                agentType: memory.agentType,
                decision: memory.decision,
                outcome: memory.outcome,
                createdAt: memory.createdAt
            }
        });
    } catch (error) {
        console.error("Store memory error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API: Analyze memory patterns
app.get("/api/agent-memory/analyze", async (req, res) => {
    try {
        const { userId, agentType, timeRange = '30days' } = req.query;
        
        // Calculate date range
        const now = new Date();
        const ranges = {
            '7days': 7,
            '30days': 30,
            '90days': 90,
            'all': 3650 // ~10 years
        };
        const days = ranges[timeRange] || 30;
        const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
        
        // Build query
        const query = { createdAt: { $gte: startDate } };
        if (userId) query.userId = userId;
        if (agentType) query.agentType = agentType;
        
        // Get all memories in range
        const memories = await AgentMemory.find(query).sort({ createdAt: -1 });
        
        // Analyze patterns
        const analysis = {
            timeRange,
            totalMemories: memories.length,
            outcomeBreakdown: {
                success: memories.filter(m => m.outcome === 'success').length,
                failure: memories.filter(m => m.outcome === 'failure').length,
                partial: memories.filter(m => m.outcome === 'partial').length,
                pending: memories.filter(m => m.outcome === 'pending').length
            },
            successRate: memories.length > 0 
                ? (memories.filter(m => m.outcome === 'success').length / memories.length * 100).toFixed(1)
                : 0,
            commonTags: {},
            avgMetrics: {
                cost: 0,
                timeElapsed: 0,
                accuracy: 0
            },
            successfulPatterns: [],
            failurePatterns: []
        };
        
        // Calculate common tags
        memories.forEach(m => {
            m.tags.forEach(tag => {
                analysis.commonTags[tag] = (analysis.commonTags[tag] || 0) + 1;
            });
        });
        
        // Calculate average metrics
        let metricsCount = 0;
        let totalCost = 0, totalTime = 0, totalAccuracy = 0;
        memories.forEach(m => {
            if (m.metrics) {
                if (m.metrics.cost) {
                    totalCost += m.metrics.cost;
                    metricsCount++;
                }
                if (m.metrics.timeElapsed) totalTime += m.metrics.timeElapsed;
                if (m.metrics.accuracy) totalAccuracy += m.metrics.accuracy;
            }
        });
        if (metricsCount > 0) {
            analysis.avgMetrics.cost = (totalCost / metricsCount).toFixed(2);
            analysis.avgMetrics.timeElapsed = (totalTime / metricsCount).toFixed(2);
            analysis.avgMetrics.accuracy = (totalAccuracy / metricsCount).toFixed(1);
        }
        
        // Extract successful patterns
        const successMemories = memories.filter(m => m.outcome === 'success');
        analysis.successfulPatterns = successMemories.slice(0, 5).map(m => ({
            decision: m.decision,
            action: m.action,
            learnings: m.learnings,
            tags: m.tags,
            date: m.createdAt
        }));
        
        // Extract failure patterns
        const failureMemories = memories.filter(m => m.outcome === 'failure');
        analysis.failurePatterns = failureMemories.slice(0, 5).map(m => ({
            decision: m.decision,
            action: m.action,
            learnings: m.learnings,
            tags: m.tags,
            date: m.createdAt
        }));
        
        res.json({
            success: true,
            analysis
        });
    } catch (error) {
        console.error("Analyze memory error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});




const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});