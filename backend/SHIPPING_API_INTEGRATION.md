# Shipping/Transfer Cost API Integration Guide

## Current Status: MOCKED DATA ⚠️

Transfer costs in the Reduce Waste feature are currently **hardcoded mock values**:
- Northeast Hub: $45.50
- Southeast Center: $52.75
- Midwest Warehouse: $58.20
- Southwest Depot: $65.90
- West Coast Hub: $78.40

## Recommended Free/Affordable Shipping APIs

### 1. **ShipEngine** ⭐ RECOMMENDED
- **Free Tier**: Yes (100 requests/month sandbox)
- **Pricing**: $0.05 per label (production)
- **Features**: Multi-carrier rates, real-time quotes
- **Documentation**: https://www.shipengine.com/docs/

#### Example Integration:
```javascript
const getShippingCost = async (fromZip, toZip, weight) => {
  const response = await fetch('https://api.shipengine.com/v1/rates/estimate', {
    method: 'POST',
    headers: {
      'API-Key': process.env.SHIPENGINE_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      carrier_ids: ["se-123456"],
      from_city_locality: "Los Angeles",
      from_state_province: "CA",
      from_postal_code: fromZip,
      to_city_locality: "Boston",
      to_state_province: "MA", 
      to_postal_code: toZip,
      weight: { value: weight, unit: "pound" },
      dimensions: { unit: "inch", length: 12, width: 12, height: 12 }
    })
  });
  
  const data = await response.json();
  return data[0].shipping_amount.amount; // Returns cost in dollars
};
```

### 2. **EasyPost**
- **Free Tier**: Yes (100 shipments/month test mode)
- **Pricing**: $0.05 per label
- **Features**: Rate shopping across carriers
- **Documentation**: https://www.easypost.com/docs/api

#### Example Integration:
```javascript
const easypost = require('@easypost/api');
const client = new easypost('YOUR_API_KEY');

const getRates = async (fromAddress, toAddress) => {
  const shipment = await client.Shipment.create({
    from_address: fromAddress,
    to_address: toAddress,
    parcel: { length: 12, width: 12, height: 12, weight: 16 }
  });
  
  return shipment.rates.map(rate => ({
    carrier: rate.carrier,
    service: rate.service,
    rate: rate.rate,
    delivery_days: rate.delivery_days
  }));
};
```

### 3. **Shippo**
- **Free Tier**: Yes (limited)
- **Pricing**: $0.05 per label
- **Features**: Multi-carrier, international shipping
- **Documentation**: https://goshippo.com/docs/

### 4. **Google Maps Distance Matrix API**
- **Free Tier**: $200/month credit (≈40,000 requests)
- **Pricing**: $0.005 per request after free tier
- **Features**: Distance and travel time (not actual shipping cost)
- **Use Case**: Estimate costs based on distance

#### Example Integration:
```javascript
const getDistance = async (origin, destination) => {
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/distancematrix/json?` +
    `origins=${origin}&destinations=${destination}&key=${process.env.GOOGLE_API_KEY}`
  );
  
  const data = await response.json();
  const distanceKm = data.rows[0].elements[0].distance.value / 1000;
  
  // Estimate: $0.50 per km for truck shipping
  return distanceKm * 0.50;
};
```

## Implementation Strategy

### Phase 1: Mock Data Enhancement (Current)
```javascript
// Add more realistic mock data based on actual shipping zones
const calculateMockShippingCost = (fromZip, toZip, weight) => {
  const zones = {
    'local': 35,      // Same state
    'regional': 55,   // Adjacent states
    'national': 85,   // Coast to coast
  };
  
  const distance = calculateZipDistance(fromZip, toZip);
  const zone = distance < 300 ? 'local' : distance < 1000 ? 'regional' : 'national';
  const baseCost = zones[zone];
  const weightCost = weight * 0.5; // $0.50 per pound
  
  return baseCost + weightCost;
};
```

### Phase 2: Hybrid Approach (Recommended for MVP)
```javascript
// Use real API for first X requests/day, fallback to intelligent mock
let apiCallsToday = 0;
const MAX_API_CALLS = 50;

const getShippingCost = async (fromZip, toZip, weight) => {
  if (apiCallsToday < MAX_API_CALLS) {
    try {
      apiCallsToday++;
      return await shipengineAPI(fromZip, toZip, weight);
    } catch (error) {
      return calculateIntelligentMock(fromZip, toZip, weight);
    }
  } else {
    return calculateIntelligentMock(fromZip, toZip, weight);
  }
};
```

### Phase 3: Full API Integration (Production)
```javascript
// Cache results to minimize API calls
const shippingCache = new Map();

const getCachedShippingCost = async (route, weight) => {
  const cacheKey = `${route.from}-${route.to}-${weight}`;
  
  if (shippingCache.has(cacheKey)) {
    const cached = shippingCache.get(cacheKey);
    // Use cached value if less than 24 hours old
    if (Date.now() - cached.timestamp < 86400000) {
      return cached.cost;
    }
  }
  
  const cost = await shipengineAPI(route.from, route.to, weight);
  shippingCache.set(cacheKey, { cost, timestamp: Date.now() });
  
  return cost;
};
```

## Current Mock Data Location

File: `backend/app.js`
Lines: ~273-320

```javascript
const warehouses = [
  {
    id: 'WH-001',
    name: 'Northeast Hub',
    location: 'Boston, MA',
    demand: (avgDemand * 1.2).toFixed(1),
    currentStock: 15,
    transferCost: 45.50,  // 👈 MOCK DATA HERE
    suggestedQty: Math.min(excessStock, Math.ceil(avgDemand * 30))
  },
  // ... more warehouses
];
```

## Warehouse Database Schema (Future Enhancement)

Create a `warehouses` collection in MongoDB:

```javascript
const warehouseSchema = new mongoose.Schema({
  id: String,
  name: String,
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  location: {
    type: { type: String, default: 'Point' },
    coordinates: [Number] // [longitude, latitude]
  },
  capacity: Number,
  currentInventory: [{
    sku: String,
    quantity: Number,
    lastUpdated: Date
  }],
  operatingCosts: {
    storagePerUnit: Number,
    handlingFee: Number
  }
});
```

## Quick Start: Add ShipEngine in 10 Minutes

1. **Sign up**: https://www.shipengine.com/ (free sandbox)
2. **Get API Key**: Dashboard → API Keys → Create
3. **Add to .env**:
   ```
   SHIPENGINE_API_KEY=your_key_here
   ```
4. **Install package**:
   ```bash
   npm install shipengine
   ```
5. **Update app.js**:
   ```javascript
   const ShipEngine = require('shipengine');
   const shipengine = new ShipEngine(process.env.SHIPENGINE_API_KEY);
   
   // Replace mock transferCost calculation
   const getTransferCost = async (fromZip, toZip) => {
     const result = await shipengine.getRatesWithShipmentDetails({
       shipment: {
         shipFrom: { postalCode: fromZip },
         shipTo: { postalCode: toZip },
         weight: { value: 10, unit: 'pound' }
       },
       rateOptions: { carrierIds: ['se-123456'] }
     });
     return result.rateResponse.rates[0].shippingAmount.amount;
   };
   ```

## Cost Comparison

| API        | Free Tier          | Per Label Cost | Best For                    |
|------------|-------------------|----------------|------------------------------|
| ShipEngine | 100 req/month     | $0.05          | Multi-carrier, full features |
| EasyPost   | 100 shipments     | $0.05          | Simple integration           |
| Shippo     | Limited           | $0.05          | International shipping       |
| Google Maps| $200 credit       | $0.005/req     | Distance-based estimates     |

## Recommendation for Your Project

**For Hackathon/MVP**: Keep enhanced mock data (Phase 1)
**For Demo/Beta**: Use ShipEngine with caching (Phase 2)
**For Production**: Full ShipEngine integration (Phase 3)

## Notes

- Transfer costs shown are **per 100 units** basis
- Actual shipping costs vary by: weight, dimensions, carrier, speed
- Consider bulk shipping discounts for large transfers
- Factor in insurance for high-value items
- Account for handling fees at destination warehouse

## Tax Benefits for Donations

If implementing donation feature, use **TaxJar API** for tax calculations:
- Free sandbox: https://www.taxjar.com/
- Deduction = 30-50% of FMV (Fair Market Value)
- Requires 501(c)(3) partner verification
