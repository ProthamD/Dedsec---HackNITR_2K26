import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const inventoryInputSchema = z.object({
  sku: z.string().describe('SKU identifier'),
  location: z.string().default('default').describe('Inventory location or warehouse'),
  horizonDays: z.number().int().min(7).max(90).default(30).describe('Planning horizon in days'),
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
  const dataset: Record<string, InventorySnapshot> = {
    'COFFEE-BEAN:nyc': {
      sku: 'COFFEE-BEAN',
      location: 'nyc',
      horizonDays,
      onHand: 420,
      inboundUnits: 180,
      leadTimeDays: 9,
      moq: 120,
      unitCost: 6.5,
      budgetCap: 5000,
      holdingCostPerUnit: 0.08,
      stockoutCostPerUnit: 4,
      safetyStockDays: 7,
      targetServiceLevel: 0.95,
      demandHistory: Array.from({ length: 21 }).map((_, idx) => ({
        date: new Date(Date.now() - idx * 86_400_000).toISOString().slice(0, 10),
        unitsSold: 45 + Math.floor((idx % 7) * 3),
      })),
      seasonalityHint: 'Winter spike due to hot beverages',
      seasonalityMultiplier: 1.18,
    },
    'YOGA-MAT:default': {
      sku: 'YOGA-MAT',
      location: 'default',
      horizonDays,
      onHand: 120,
      inboundUnits: 0,
      leadTimeDays: 14,
      moq: 80,
      unitCost: 12,
      budgetCap: 3000,
      holdingCostPerUnit: 0.05,
      stockoutCostPerUnit: 6,
      safetyStockDays: 10,
      targetServiceLevel: 0.92,
      demandHistory: Array.from({ length: 21 }).map((_, idx) => ({
        date: new Date(Date.now() - idx * 86_400_000).toISOString().slice(0, 10),
        unitsSold: 12 + Math.floor((Math.sin(idx / 3) + 1) * 4),
      })),
      seasonalityHint: 'New Year fitness lift',
      seasonalityMultiplier: 1.25,
    },
  };

  const key = `${sku.toUpperCase()}:${location.toLowerCase()}`;
  const snapshot = dataset[key];

  if (!snapshot) {
    throw new Error(`SKU '${sku}' not found for location '${location}'. Add it to the dataset or connect a real data source.`);
  }

  return snapshot;
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
