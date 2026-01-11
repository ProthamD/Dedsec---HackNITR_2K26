import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const inventoryInputSchema = z.object({
  sku: z.string().describe('SKU identifier'),
  location: z.string().default('Main-Warehouse').describe('Inventory location or warehouse'),
  horizonDays: z.number().int().default(21).describe('Planning horizon in days'),
  userId: z.string().default('user123').describe('User ID for fetching inventory'),
});

export const inventoryOutputSchema = z.object({
  sku: z.string(),
  name: z.string(),
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

const buildSnapshot = async (
  sku: string,
  location: string,
  horizonDays: number,
  userId: string,
): Promise<InventorySnapshot> => {
  try {
    // Fetch inventory data from backend API
    const response = await fetch(`http://localhost:3000/api/inventory?userId=${userId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch inventory: ${response.statusText}`);
    }
    
    const inventoryData = await response.json();
    
    // Find the matching item
    const item = inventoryData.find(
      (item: any) => item.sku && item.location && 
                    item.sku.toUpperCase() === sku.toUpperCase() && 
                    item.location.toLowerCase() === location.toLowerCase()
    );

    if (!item) {
      throw new Error(`SKU '${sku}' not found for location '${location}' in user's inventory.`);
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
      // Ensure demandHistory dates are strings and unitsSold are numbers
      demandHistory: item.demandHistory.map((d: any) => ({
        date: typeof d.date === 'string' ? d.date : new Date(d.date).toISOString().split('T')[0],
        unitsSold: typeof d.unitsSold === 'number' ? d.unitsSold : parseInt(d.unitsSold),
      })),
    };
  } catch (error) {
    throw new Error(`Error fetching inventory: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const getInventorySnapshot = async (
  input: z.infer<typeof inventoryInputSchema>,
): Promise<InventorySnapshot> => {
  return buildSnapshot(input.sku, input.location, input.horizonDays, input.userId);
};

export const inventreeTool = createTool({
  id: 'get-inventory-snapshot',
  description: 'Get real-time inventory snapshot, demand history, and constraints for a SKU from the database',
  inputSchema: inventoryInputSchema,
  outputSchema: inventoryOutputSchema,
  execute: async ({ context }) => {
    return buildSnapshot(context.sku, context.location, context.horizonDays, context.userId);
  },
});


