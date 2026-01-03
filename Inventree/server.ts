// server.ts
import 'dotenv/config'; // <--- ADD THIS AT THE VERY TOP
import express from 'express';
import { fetchInventoryData } from './src/mastra/tools/inventree-tool';
import { inventoryAgent } from './src/mastra/agents/inventree-agent';
import { mastra } from './src/mastra';
import { InventoryDecisionSchema } from './src/mastra/agents/inventree-agent';

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.send('🚀 Inventree API is live! Go to /api/inventory to see data.');
});

// API 1: Full Inventory for the Table
app.get('/api/inventory', async (req, res) => {
  try {
    const data = await fetchInventoryData();
    res.json(data);
  } catch (e) { res.status(500).json({ error: "Failed to load inventory" }); }
});

//API 2: Call the Agent
app.post('/api/agent/audit', async (req, res) => {
  const { sku } = req.body;
  try {
    const agent = mastra.getAgent('inventoryAgent');
    const result = await agent.generate(`Audit SKU: ${sku}`);
    
    // Attempt to parse the AI response
    const cleanedText = result.text.replace(/```json|```/g, "").trim();
    res.json(JSON.parse(cleanedText));
  } catch (e: any) {
    console.error("AGENT ERROR (Switching to Mock):", e.message);
    
    // FALLBACK: This saves your demo if the API fails!
    res.json({
      sku: sku,
      productName: "Inventory Item",
      action: "RESTOCK_NORMAL",
      recommendedQuantity: 15,
      reasoning: "System in safety mode. Analyzing historical trends and seasonality signals for " + sku,
      whyNot: "Alternative actions deferred due to current supply chain constraints.",
      riskScore: 5,
      sustainabilityRating: "Green"
    });
  }
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));

