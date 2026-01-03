const express = require("express");
const app = express();
const path = require("path");
require("dotenv").config();
const cors = require("cors");
const Inventory = require("./models/Inventory");


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
        
        res.redirect("/");
    } catch (error) {
        console.error("Error adding inventory:", error);
        res.status(500).send("Error adding inventory: " + error.message);
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




const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});