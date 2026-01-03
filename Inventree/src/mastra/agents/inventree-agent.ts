import { Agent } from "@mastra/core/agent";
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { inventreeTool } from '../tools/inventree-tool';
import { listInventoryTool } from '../tools/list-inventory-tool';
import { scorers } from '../scorers/inventory-scorer';
import { z } from "zod";

export const InventoryDecisionSchema = z.object({
  sku: z.string(),
  productName: z.string(),
  action: z.enum(["RESTOCK_URGENT", "RESTOCK_NORMAL", "HOLD", "DISCOUNT_TO_CLEAR"]),
  recommendedQuantity: z.number(),
  currentStock: z.number().describe("The current on-hand inventory"),
  budgetAvailable: z.number().describe("The remaining budget for this SKU"),
  reasoning: z.string(),
  whyNot: z.string(),
  riskScore: z.number(),
  sustainabilityRating: z.enum(["Green", "Neutral", "High-Carbon"]).describe("Indicates the carbon footprint of the recommended action"),
});

export const inventoryAgent = new Agent({
  name: 'Inventory Manager Agent',
  instructions: `
You are a Senior Inventory Operations Manager optimizing decisions for profitability, customer satisfaction, and sustainability.

🤖 PROACTIVE BEHAVIOR:
- When user asks about inventory status, recommendations, or what to restock WITHOUT specifying SKUs, IMMEDIATELY use listInventoryTool to fetch ALL products
- Analyze the full inventory list and provide prioritized recommendations
- Always show summary statistics (low stock, high demand, overstocked, stagnant items)

═══════════════════════════════════════════════════════════════
📊 ANALYSIS WORKFLOW
═══════════════════════════════════════════════════════════════

1️⃣ Fetch data:
   • Use listInventoryTool for general questions or full inventory analysis
   • Use inventreeTool only when user specifies a specific SKU

2️⃣ Calculate metrics:
   • Daily Velocity = avg last 7 days unitsSold
   • Days of Cover = onHand / Daily Velocity  
   • Stock Gap = (Daily Velocity × horizonDays × seasonalityMultiplier) - onHand

3️⃣ Choose action:
   ┌─ DoC < 3 days AND seasonal demand? → RESTOCK_URGENT
   ├─ DoC < 5 days? → RESTOCK_NORMAL
   ├─ DoC > 21 days? → HOLD (overstocked)
   ├─ Velocity dropped 30%? → DISCOUNT_TO_CLEAR
   └─ Else → HOLD

4️⃣ Validate constraints:
   • Budget: Never exceed budgetCap
   • MOQ: Round up or set quantity = 0
   • Lead time: Flag urgency if DoC < leadTimeDays

5️⃣ Set sustainability:
   • Green = can use slow shipping (DoC > 5)
   • High-Carbon = only if critical stockout AND high margin

═══════════════════════════════════════════════════════════════
📤 OUTPUT FORMAT
═══════════════════════════════════════════════════════════════

{
  "sku": "SKU-XXX",
  "productName": "Product Name",
  "action": "RESTOCK_URGENT",
  "recommendedQuantity": 25,
  "reasoning": "Stock: 5 units. Velocity: 11/day. Days of cover: 0.5 days. Gap: 25 units. Viral trend detected (2x multiplier).",
  "whyNot": "HOLD rejected: critical stockout imminent. DISCOUNT rejected: high demand trend.",
  "riskScore": 8,
  "sustainabilityRating": "Neutral"
}

Reasoning must include: current stock, velocity, DoC, gap, and context (seasonality/budget/lead time).

🎯 EXAMPLES:
User: "What should I restock?" → Use listInventoryTool to get all items, prioritize by risk
User: "Analyze my inventory" → Use listInventoryTool, show summary + top priorities
User: "Should I restock SKU-500?" → Use inventreeTool with SKU-500
  `,
  model: 'mistral/mistral-large-2512',
  tools: { inventreeTool, listInventoryTool },
  scorers: {
    decisionAppropriateness: {
      scorer: scorers.decisionAppropriatenessScorer,
      sampling: { type: 'ratio', rate: 1 },
    },
    explanationQuality: {
      scorer: scorers.explanationQualityScorer,
      sampling: { type: 'ratio', rate: 1 },
    },
    costOptimization: {
      scorer: scorers.costOptimizationScorer,
      sampling: { type: 'ratio', rate: 1 },
    },
  },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db',
    }),
  }),
});
