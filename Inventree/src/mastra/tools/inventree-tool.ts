import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import inventoryData from '../../data/inventory.json';
import * as fs from 'fs/promises';
import path from 'path';

const inventoryInputSchema = z.object({
  sku: z.string().describe('SKU identifier'),
  location: z.string().default('Main-Warehouse').describe('Inventory location or warehouse'),
  horizonDays: z.union([z.string(), z.number()]).transform(val => {
    const num = typeof val === 'string' ? parseInt(val, 10) : val;
    if (isNaN(num) || num < 7 || num > 90) {
      throw new Error('Planning horizon must be between 7 and 90 days');
    }
    return num;
  }).default(30).describe('Planning horizon in days (between 7 and 90)'),
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

// Export this so the API route can use it without the Agent
export const fetchInventoryData = async () => {
  const dataPath = path.resolve(process.cwd(), 'src/data/inventory.json');
  const fileContent = await fs.readFile(dataPath, 'utf-8');
  return JSON.parse(fileContent);
};

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
    demandHistory: item.demandHistory.slice(-horizonDays),
  };
};

export const inventreeTool = createTool({
  id: 'get-inventory-snapshot',
  description: 'Get inventory snapshot, demand history, and constraints for a SKU',
  inputSchema: inventoryInputSchema,
  outputSchema: inventoryOutputSchema,
  execute: async ({ context }) => {
    return buildSnapshot(context.sku, context.location, context.horizonDays);
  },
});


