import { Agent } from "@mastra/core/agent";
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { inventreeTool } from '../tools/inventree-tool';
import { scorers } from '../scorers/inventory-scorer';
import { z } from "zod";

const InventoryDecisionSchema = z.object({
  sku: z.string(),
  productName: z.string(),
  action: z.enum(["RESTOCK_URGENT", "RESTOCK_NORMAL", "HOLD", "DISCOUNT_TO_CLEAR"]),
  recommendedQuantity: z.number(),
  reasoning: z.string().describe("Human-like explanation of why this action was taken"),
  whyNot: z.string().describe("Explanation of why alternative actions were rejected"),
  riskScore: z.number().min(1).max(10),
});

export const inventoryAgent = new Agent({
  name: 'Inventory Manager Agent',
  instructions: `
    You are an expert Inventory Operations Manager. 
    Your goal is to optimize stock levels based on demand, budget, and storage constraints.
    
    When a user provides inventory data:
    1. Analyze the 7-day sales trend.
    2. Check if the current stock lasts at least 5 days.
    3. Make a decision: RESTOCK, DELAY, or REALLOCATE.
    4. EXPLAIN YOUR REASONING: Why did you pick this action? 
    5. WHY NOT: Why did you reject the other two actions? (e.g., "Rejected Restock because budget is over limit").
    
    Use the inventreeTool to fetch inventory snapshots and the scorers to evaluate decisions.
    Return concise, structured JSON where appropriate.
  `,
  model: 'google/gemini-2.0-flash',
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
