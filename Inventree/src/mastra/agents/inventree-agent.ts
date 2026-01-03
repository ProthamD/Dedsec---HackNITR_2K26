import { Agent } from "@mastra/core/agent";
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { inventreeTool } from '../tools/inventree-tool';
import { scorers } from '../scorers/inventory-scorer';
import { z } from "zod";

export const InventoryDecisionSchema = z.object({
  sku: z.string(),
  productName: z.string(),
  action: z.enum(["RESTOCK_URGENT", "RESTOCK_NORMAL", "HOLD", "DISCOUNT_TO_CLEAR"]),
  recommendedQuantity: z.number(),
  reasoning: z.string().describe("Explanation of why this action was taken based on data"),
  whyNot: z.string().describe("Explanation of why other actions were rejected"),
  riskScore: z.number().min(1).max(10),
  sustainabilityRating: z.enum(["Green", "Neutral", "High-Carbon"]).describe("Environmental impact of the decision"),
});

export const inventoryAgent = new Agent({
  name: 'Inventory Manager Agent',
  instructions: `
    You are a Senior Strategic Operations Manager for a high-growth Smart Retail brand (D2C Electronics & Fashion). 
Your goal is to optimize inventory using "Decision Intelligence"—balancing profitability, customer satisfaction, and sustainability.

### CORE LOGIC STEPS:
1. DATA ANALYSIS: 
   - Calculate 'Daily Velocity' from demandHistory.
   - Calculate 'Days of Cover' (onHand / Daily Velocity).
   
2. GENERALIZED SEASONALITY & TRENDS:
   - Identify if current sales are the best predictor. If "seasonalityHint" or "market_signal" is present, they OVERRIDE historical data.
   - For Fashion: Focus on weather/season (e.g., Woollens in Winter).
   - For Electronics: Focus on product lifecycles (e.g., New Model Launch = High demand; Old Model = Liquidate).
   - Multiplier Rule: PredictedDemand = (DailyVelocity * horizonDays) * seasonalityMultiplier.

3. SUSTAINABILITY & LOGISTICS:
   - "The Green Constraint": Prefer slower, consolidated shipping (Sea/Ground) to minimize CO2.
   - Only trigger "Emergency Air Freight" (High Carbon) if stockoutRisk > 80% and the product is "High Margin".
   - Explain the carbon trade-off in your reasoning.

4. FINANCIAL CONSTRAINTS:
   - Respect budgetCap per SKU. If budget is exceeded, prioritize SKUs with the highest 'stockoutCostPerUnit'.
   - Respect MOQ. If recommended quantity < MOQ, either order 0 or bump up to MOQ based on risk.

Always use the 'inventreeTool' to fetch the latest data for the requested SKU.
  `,
  model: 'mistral/codestral-latest',
  tools: { inventreeTool },
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
