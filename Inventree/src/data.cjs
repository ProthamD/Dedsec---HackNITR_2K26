const fs = require('fs');
const path = require('path');

const generateHistory = (baseSales, trend = 1) => {
  const history = [];
  const today = new Date();
  for (let i = 21; i > 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    // Multiply by trend to simulate growth or decline over the 21 days
    const trendFactor = 1 + (trend - 1) * (i / 21);
    history.push({
      date: date.toISOString().split('T')[0],
      unitsSold: Math.max(0, Math.floor(baseSales * trendFactor * (0.8 + Math.random() * 0.4)))
    });
  }
  return history;
};

const categories = [
  { name: "Smartphone", cost: 800, baseSales: 5, budget: 15000 },
  { name: "Earbuds", cost: 50, baseSales: 20, budget: 3000 },
  { name: "Charger", cost: 15, baseSales: 40, budget: 2000 },
  { name: "Smartwatch", cost: 200, baseSales: 8, budget: 5000 },
  { name: "Laptop", cost: 1200, baseSales: 2, budget: 20000 }
];

const inventoryData = [];

for (let i = 0; i < 15; i++) {
  const cat = categories[i % categories.length];
  // Create variations in the data to test the agent
  const isViral = i === 0; // First item is viral
  const isLowBudget = i === 4; // Fifth item has a tiny budget cap
  const longLeadTime = i === 7; // Eighth item takes forever to arrive

  inventoryData.push({
    sku: `SKU-${200 + i}`,
    name: `${cat.name} ${String.fromCharCode(65 + i)}`,
    location: "Main-Warehouse",
    horizonDays: 21,
    onHand: isViral ? 5 : Math.floor(Math.random() * 60) + 10,
    inboundUnits: 0,
    leadTimeDays: longLeadTime ? 15 : Math.floor(Math.random() * 4) + 2,
    moq: 5,
    unitCost: cat.cost,
    budgetCap: isLowBudget ? 500 : cat.budget,
    holdingCostPerUnit: (cat.cost * 0.01).toFixed(2),
    stockoutCostPerUnit: (cat.cost * 1.2).toFixed(2),
    safetyStockDays: 3,
    targetServiceLevel: 0.95,
    demandHistory: generateHistory(cat.baseSales, isViral ? 2.5 : 1.0), // Viral item has 2.5x growth trend
    seasonalityHint: isViral ? "Influencer Shoutout" : "Stable",
    seasonalityMultiplier: isViral ? 2.0 : 1.0
  });
}

const dir = path.join(__dirname, 'data');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

fs.writeFileSync(path.join(dir, 'inventory.json'), JSON.stringify(inventoryData, null, 2));
console.log("inventory.json generated with 15 diverse test cases!");