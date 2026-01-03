import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import inventoryData from '../../data/inventory.json';

const inventoryInputSchema = z.object({
  sku: z.string().describe('SKU identifier'),
  location: z.string().default('default').describe('Inventory location or warehouse'),
  horizonDays: z.number().int().default(30).describe('Planning horizon in days'),
});

export const inventoryOutputSchema = z.object({
  sku: z.string(),
  location: z.string(),
  horizonDays: z.number(),
  onHand: z.number(),
  inboundUnits: z.number(),
  leadTimeDays: z.number(),
  moq: z.number(),
  unitCost: z.number(),
  budgetCap: z.number(),
  holdingCostPerUnit: z.number(),
  stockoutCostPerUnit: z.number(),
  safetyStockDays: z.number(),
  targetServiceLevel: z.number(),
  demandHistory: z.array(
    z.object({
      date: z.string(),
      unitsSold: z.number(),
    }),
  ),
  seasonalityHint: z.string(),
  seasonalityMultiplier: z.number(),
});

type InventorySnapshot = z.infer<typeof inventoryOutputSchema>;

const buildSnapshot = (
  sku: string,
  location: string,
  horizonDays: number,
): InventorySnapshot => {
  // Find the matching item from inventory.json
  const item = inventoryData.find(
    (item) => item.sku.toUpperCase() === sku.toUpperCase() && 
              item.location.toLowerCase() === location.toLowerCase()
  );

  if (!item) {
    throw new Error(`SKU '${sku}' not found for location '${location}'. Available SKUs in inventory.json.`);
  }

  // Convert string cost fields to numbers and use horizonDays parameter
  return {
    ...item,
    horizonDays,
    holdingCostPerUnit: typeof item.holdingCostPerUnit === 'string' 
      ? parseFloat(item.holdingCostPerUnit) 
      : item.holdingCostPerUnit,
    stockoutCostPerUnit: typeof item.stockoutCostPerUnit === 'string' 
      ? parseFloat(item.stockoutCostPerUnit) 
      : item.stockoutCostPerUnit,
  };
};

export const getInventorySnapshot = (
  input: z.infer<typeof inventoryInputSchema>,
): InventorySnapshot => {
  return buildSnapshot(input.sku, input.location, input.horizonDays);
};

export const inventreeTool = createTool({
  id: 'get-inventory-snapshot',
  description: 'Get inventory snapshot, demand history, and constraints for a SKU',
  inputSchema: inventoryInputSchema,
  outputSchema: inventoryOutputSchema,
  execute: async ({ context }) => {
    return getInventorySnapshot(context);
  },
});
