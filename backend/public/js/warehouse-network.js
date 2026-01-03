// Warehouse Network Communication System

let stockRequests = [];
let transferHistory = [];

// Initialize the warehouse network
async function initWarehouseNetwork() {
    await loadExcessStock();
    await loadActiveRequests();
    await loadTransferHistory();
    feather.replace();
}

// Load excess stock items (overstock or near waste)
async function loadExcessStock() {
    const excessStockDiv = document.getElementById('excessStock');
    
    try {
        const response = await fetch('/api/warehouse-excess-stock');
        const data = await response.json();
        
        if (data.success && data.excessItems && data.excessItems.length > 0) {
            excessStockDiv.innerHTML = data.excessItems.map(item => `
                <div class="p-3 rounded-lg transition-all hover:scale-102" style="background: var(--bg-card); border: 1px solid var(--border);">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <div class="font-semibold" style="color: var(--text-primary);">${item.productName}</div>
                            <div class="text-xs" style="color: var(--text-muted);">SKU: ${item.sku}</div>
                        </div>
                        <div class="px-2 py-1 rounded text-xs font-semibold" style="background: rgba(239, 68, 68, 0.1); color: rgb(239, 68, 68);">
                            ${item.reason}
                        </div>
                    </div>
                    <div class="flex items-center justify-between">
                        <div class="text-sm" style="color: var(--text-muted);">
                            <span style="color: var(--accent-green); font-weight: 600;">${item.availableQuantity} units</span> available
                        </div>
                        <button 
                            onclick="offerTransfer('${item.sku}', ${item.availableQuantity})"
                            class="px-3 py-1 rounded text-xs font-medium transition-all hover:scale-105"
                            style="background: var(--accent-green); color: var(--bg-primary);">
                            Offer Transfer
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            excessStockDiv.innerHTML = `
                <div class="p-3 rounded-lg text-center" style="background: var(--bg-card); color: var(--text-muted); font-size: 0.85em;">
                    ✅ No excess stock - all inventory levels optimal
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading excess stock:', error);
        excessStockDiv.innerHTML = `
            <div class="p-3 rounded-lg text-center" style="background: var(--bg-card); color: rgb(239, 68, 68); font-size: 0.85em;">
                Error loading excess stock
            </div>
        `;
    }
    
    feather.replace();
}

// Create a stock request
async function createStockRequest() {
    const product = document.getElementById('requestProduct').value.trim();
    const quantity = parseInt(document.getElementById('requestQuantity').value);
    const warehouse = document.getElementById('requestWarehouse').value;
    
    if (!product || !quantity || !warehouse) {
        alert('Please fill in all fields');
        return;
    }
    
    try {
        const response = await fetch('/api/warehouse-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                product,
                quantity,
                requestingWarehouse: warehouse,
                userId: document.getElementById('userId').value
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Clear form
            document.getElementById('requestProduct').value = '';
            document.getElementById('requestQuantity').value = '';
            document.getElementById('requestWarehouse').value = '';
            
            // Show success message
            showNotification('Request created successfully! 📨', 'success');
            
            // Reload requests
            await loadActiveRequests();
        } else {
            showNotification(data.message || 'Failed to create request', 'error');
        }
    } catch (error) {
        console.error('Error creating request:', error);
        showNotification('Error creating request', 'error');
    }
}

// Load active stock requests
async function loadActiveRequests() {
    const requestsDiv = document.getElementById('activeRequests');
    
    try {
        const response = await fetch('/api/warehouse-requests');
        const data = await response.json();
        
        if (data.success && data.requests && data.requests.length > 0) {
            requestsDiv.innerHTML = data.requests.map(req => `
                <div class="p-3 rounded-lg" style="background: var(--bg-card); border-left: 3px solid var(--accent-green);">
                    <div class="flex justify-between items-start mb-1">
                        <div class="font-semibold text-sm" style="color: var(--text-primary);">${req.product}</div>
                        <div class="text-xs px-2 py-1 rounded" style="background: rgba(76, 175, 80, 0.1); color: var(--accent-green);">
                            ${req.status}
                        </div>
                    </div>
                    <div class="text-xs mb-2" style="color: var(--text-muted);">
                        ${req.quantity} units needed • ${req.requestingWarehouse}
                    </div>
                    ${req.status === 'pending' ? `
                        <button 
                            onclick="fulfillRequest('${req.id}')"
                            class="text-xs px-3 py-1 rounded font-medium transition-all hover:scale-105"
                            style="background: var(--accent-green); color: var(--bg-primary);">
                            Fulfill Request
                        </button>
                    ` : ''}
                </div>
            `).join('');
        } else {
            requestsDiv.innerHTML = `
                <div class="p-3 rounded-lg text-center" style="background: var(--bg-card); color: var(--text-muted); font-size: 0.85em;">
                    No active requests
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading requests:', error);
    }
    
    feather.replace();
}

// Offer to transfer excess stock
async function offerTransfer(sku, availableQuantity) {
    const quantity = prompt(`How many units of ${sku} do you want to offer? (Max: ${availableQuantity})`);
    
    if (!quantity || quantity <= 0 || quantity > availableQuantity) {
        alert('Invalid quantity');
        return;
    }
    
    const toWarehouse = prompt('Enter destination warehouse ID (e.g., wh-boston):');
    
    if (!toWarehouse) {
        alert('Please specify a destination warehouse');
        return;
    }
    
    try {
        const response = await fetch('/api/warehouse-transfer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sku,
                quantity: parseInt(quantity),
                fromWarehouse: 'wh-boston', // This should come from user's current warehouse
                toWarehouse,
                userId: document.getElementById('userId').value
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Transfer initiated successfully! 🚚', 'success');
            await loadExcessStock();
            await loadTransferHistory();
        } else {
            showNotification(data.message || 'Transfer failed', 'error');
        }
    } catch (error) {
        console.error('Error initiating transfer:', error);
        showNotification('Error initiating transfer', 'error');
    }
}

// Fulfill a stock request
async function fulfillRequest(requestId) {
    if (!confirm('Fulfill this stock request?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/warehouse-request/${requestId}/fulfill`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: document.getElementById('userId').value
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Request fulfilled! 📦', 'success');
            await loadActiveRequests();
            await loadTransferHistory();
        } else {
            showNotification(data.message || 'Failed to fulfill request', 'error');
        }
    } catch (error) {
        console.error('Error fulfilling request:', error);
        showNotification('Error fulfilling request', 'error');
    }
}

// Load transfer history
async function loadTransferHistory() {
    const historyDiv = document.getElementById('transferHistory');
    
    try {
        const response = await fetch('/api/warehouse-transfers');
        const data = await response.json();
        
        if (data.success && data.transfers && data.transfers.length > 0) {
            historyDiv.innerHTML = data.transfers.map(transfer => `
                <div class="p-3 rounded-lg flex items-center justify-between" style="background: var(--bg-card); border: 1px solid var(--border);">
                    <div class="flex items-center gap-3">
                        <div class="text-2xl">${transfer.status === 'completed' ? '✅' : '🚚'}</div>
                        <div>
                            <div class="font-semibold text-sm" style="color: var(--text-primary);">
                                ${transfer.product} (${transfer.quantity} units)
                            </div>
                            <div class="text-xs" style="color: var(--text-muted);">
                                ${transfer.fromWarehouse} → ${transfer.toWarehouse}
                            </div>
                        </div>
                    </div>
                    <div class="text-xs" style="color: var(--text-muted);">
                        ${new Date(transfer.date).toLocaleDateString()}
                    </div>
                </div>
            `).join('');
        } else {
            historyDiv.innerHTML = `
                <div class="p-3 rounded-lg text-center" style="background: var(--bg-card); color: var(--text-muted); font-size: 0.85em;">
                    No transfer history
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading transfer history:', error);
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 px-6 py-3 rounded-lg font-medium z-50 animate-slide-in';
    notification.style.cssText = `
        background: ${type === 'success' ? 'var(--accent-green)' : type === 'error' ? 'rgb(239, 68, 68)' : 'var(--bg-card)'};
        color: ${type === 'success' || type === 'error' ? 'white' : 'var(--text-primary)'};
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('excessStock')) {
        initWarehouseNetwork();
        // Refresh every 30 seconds
        setInterval(() => {
            loadActiveRequests();
            loadTransferHistory();
        }, 30000);
    }
});
