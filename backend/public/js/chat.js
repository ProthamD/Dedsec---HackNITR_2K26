// Chat functionality
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');

// Get userId from page
const userId = document.getElementById('userId')?.value || 'user123';

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    // Disable input
    messageInput.disabled = true;
    sendBtn.disabled = true;

    // Add user message to chat
    addMessage(message, 'user');
    messageInput.value = '';

    // Show typing indicator
    showTypingIndicator();

    try {
        // Send to backend
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, userId })
        });

        const data = await response.json();
        
        // Hide typing indicator
        hideTypingIndicator();

        // Add bot response
        if (data.error) {
            addMessage('Sorry, I encountered an error: ' + data.message, 'bot');
        } else {
            // Extract the text from Mastra response
            let botMessage = data.text || data.message;
            
            // Check if response contains JSON (with or without markdown code blocks)
            let jsonMatch = botMessage.match(/```json\s*(\{[\s\S]*?\})\s*```|^(\{[\s\S]*\})$/);
            if (jsonMatch) {
                try {
                    const jsonString = jsonMatch[1] || jsonMatch[2];
                    const jsonData = JSON.parse(jsonString);
                    botMessage = formatJsonResponse(jsonData);
                } catch (e) {
                    // Keep original if not valid JSON
                    botMessage = cleanMarkdownResponse(botMessage);
                }
            } else if (botMessage) {
                // Clean up markdown formatting
                botMessage = cleanMarkdownResponse(botMessage);
            }
            
            addMessage(botMessage || JSON.stringify(data), 'bot');
        }
    } catch (error) {
        hideTypingIndicator();
        addMessage('Sorry, I couldn\'t connect to the AI. Please make sure Mastra is running on port 4111.', 'bot');
    }

    // Re-enable input
    messageInput.disabled = false;
    sendBtn.disabled = false;
    messageInput.focus();
}

function addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    
    if (sender === 'user') {
        messageDiv.className = 'flex gap-3 flex-row-reverse';
        messageDiv.innerHTML = `
            <div style="width: 32px; height: 32px; background: hsl(240, 4%, 18%); border-radius: 0.5rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <svg style="width: 16px; height: 16px; color: hsl(0, 0%, 98%);" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
                </svg>
            </div>
            <div style="background: hsl(240, 4%, 18%); color: hsl(0, 0%, 98%); padding: 0.75rem 1rem; border-radius: 1rem; border-bottom-right-radius: 0.25rem; max-width: 80%;">
                <p style="font-size: 0.875rem; line-height: 1.5;">${text}</p>
            </div>
        `;
    } else {
        messageDiv.className = 'flex gap-3';
        messageDiv.innerHTML = `
            <div style="width: 32px; height: 32px; background: hsl(240, 5%, 14%); border-radius: 0.5rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <svg style="width: 16px; height: 16px; color: hsl(240, 5%, 64%);" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 7H7v6h6V7z"/>
                    <path fill-rule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clip-rule="evenodd"/>
                </svg>
            </div>
            <div style="background: hsl(240, 5%, 14%); color: hsl(0, 0%, 98%); padding: 0.75rem 1rem; border-radius: 1rem; border-bottom-left-radius: 0.25rem; max-width: 80%;">
                <p style="font-size: 0.875rem; line-height: 1.5;">${text}</p>
            </div>
        `;
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'flex gap-3';
    indicator.id = 'typingIndicator';
    indicator.innerHTML = `
        <div style="width: 32px; height: 32px; background: hsl(240, 5%, 14%); border-radius: 0.5rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <svg style="width: 16px; height: 16px; color: hsl(240, 5%, 64%);" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13 7H7v6h6V7z"/>
                <path fill-rule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clip-rule="evenodd"/>
            </svg>
        </div>
        <div style="background: hsl(240, 5%, 14%); color: hsl(0, 0%, 98%); padding: 0.75rem 1rem; border-radius: 1rem; border-bottom-left-radius: 0.25rem;">
            <div style="display: flex; gap: 0.5rem;">
                <span style="width: 0.75rem; height: 0.75rem; background: hsl(240, 5%, 64%); border-radius: 9999px; animation: bounce 1s infinite; animation-delay: 0s;"></span>
                <span style="width: 0.75rem; height: 0.75rem; background: hsl(240, 5%, 64%); border-radius: 9999px; animation: bounce 1s infinite; animation-delay: 0.15s;"></span>
                <span style="width: 0.75rem; height: 0.75rem; background: hsl(240, 5%, 64%); border-radius: 9999px; animation: bounce 1s infinite; animation-delay: 0.3s;"></span>
            </div>
        </div>
    `;
    chatMessages.appendChild(indicator);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.remove();
}

function cleanMarkdownResponse(text) {
    if (!text) return '';
    
    // Remove excessive separators
    text = text.replace(/^-{3,}$/gm, '');
    text = text.replace(/^={3,}$/gm, '');
    
    // Convert markdown tables to HTML
    text = text.replace(/\|(.+)\|/g, (match, content) => {
        const cells = content.split('|').map(c => c.trim()).filter(c => c);
        if (cells.every(c => c.match(/^[-:]+$/))) return ''; // Skip separator row
        const cellTags = cells.map(c => `<td class="px-3 py-2 border-b border-gray-700">${c}</td>`).join('');
        return `<tr>${cellTags}</tr>`;
    });
    
    // Wrap tables
    if (text.includes('<tr>')) {
        text = text.replace(/(<tr>.*<\/tr>)/gs, '<table class="w-full bg-gray-800/30 rounded-lg my-3 text-sm">$1</table>');
    }
    
    // Convert headers
    text = text.replace(/^###\s+(.+)$/gm, '<div class="text-lg font-bold mt-4 mb-2">$1</div>');
    text = text.replace(/^##\s+(.+)$/gm, '<div class="text-xl font-bold mt-4 mb-2">$1</div>');
    text = text.replace(/^#\s+(.+)$/gm, '<div class="text-2xl font-bold mt-4 mb-2">$1</div>');
    
    // Convert bold
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // Convert code blocks
    text = text.replace(/```(\w+)?\n([\s\S]+?)```/g, (match, lang, code) => {
        return `<pre class="bg-gray-800/50 rounded-lg p-3 my-2 overflow-x-auto text-xs"><code>${code.trim()}</code></pre>`;
    });
    
    // Convert inline code
    text = text.replace(/`([^`]+)`/g, '<code class="bg-gray-800/50 px-2 py-1 rounded text-xs">$1</code>');
    
    // Convert bullet points
    text = text.replace(/^[\-\*]\s+(.+)$/gm, '<div class="ml-4 mb-1">• $1</div>');
    text = text.replace(/^\d+\.\s+(.+)$/gm, '<div class="ml-4 mb-1">$1</div>');
    
    // Convert line breaks
    text = text.replace(/\n\n/g, '<br><br>');
    text = text.replace(/\n/g, '<br>');
    
    // Clean up excessive breaks
    text = text.replace(/(<br>){3,}/g, '<br><br>');
    
    return text;
}

function formatJsonResponse(json) {
    if (!json) return 'No response received.';
    
    // Format comprehensive restock recommendation
    if (json.action && json.sku) {
        const actionEmoji = {
            'RESTOCK_URGENT': '🚨',
            'RESTOCK_NORMAL': '📦',
            'HOLD': '⏸️',
            'DISCOUNT_TO_CLEAR': '💸'
        };
        
        const emoji = actionEmoji[json.action] || '📊';
        const productName = json.productName || json.sku;
        
        let response = `<div class="space-y-4">`;
        
        // Title
        response += `<div class="text-xl font-bold mb-4">
            ${emoji} Inventory Analysis for ${productName} (${json.sku})
        </div>`;
        
        // 📊 Fetched Data Summary
        response += `<div class="mb-4">
            <div class="font-bold text-lg mb-2">📊 Data Summary</div>
            <div class="bg-gray-800/50 rounded-lg p-3 space-y-1 text-sm">
                <div><span class="text-gray-400">SKU:</span> ${json.sku}</div>
                <div><span class="text-gray-400">Product:</span> ${productName}</div>
                <div><span class="text-gray-400">Recommended Action:</span> <strong>${json.action.replace(/_/g, ' ')}</strong></div>
                ${json.recommendedQuantity ? `<div><span class="text-gray-400">Quantity:</span> <strong>${json.recommendedQuantity} units</strong></div>` : ''}
            </div>
        </div>`;
        
        // 📈 Analysis
        if (json.reasoning) {
            response += `<div class="mb-4">
                <div class="font-bold text-lg mb-2">📈 Analysis</div>
                <div class="bg-gray-800/50 rounded-lg p-3 text-sm leading-relaxed">
                    ${json.reasoning}
                </div>
            </div>`;
        }
        
        // 🔍 Decision Logic
        if (json.whyNot) {
            response += `<div class="mb-4">
                <div class="font-bold text-lg mb-2">🔍 Why This Action?</div>
                <div class="bg-gray-800/50 rounded-lg p-3 text-sm leading-relaxed">
                    ${json.whyNot}
                </div>
            </div>`;
        }
        
        // Risk & Sustainability
        response += `<div class="flex gap-2 mb-2">`;
        if (json.riskScore !== undefined) {
            const riskColor = json.riskScore >= 7 ? 'text-red-400' : json.riskScore >= 4 ? 'text-yellow-400' : 'text-green-400';
            response += `<div class="bg-gray-800/50 rounded-lg px-3 py-2 text-sm flex-1">
                <span class="text-gray-400">Risk Score:</span> 
                <strong class="${riskColor}">${json.riskScore}/10</strong>
            </div>`;
        }
        if (json.sustainabilityRating) {
            response += `<div class="bg-gray-800/50 rounded-lg px-3 py-2 text-sm flex-1">
                <span class="text-gray-400">Sustainability:</span> 
                <strong>${json.sustainabilityRating}</strong>
            </div>`;
        }
        response += `</div>`;
        
        // ✅ Next Steps
        response += `<div class="mt-4 pt-3 border-t border-gray-600">
            <div class="font-bold text-sm mb-2">✅ Recommended Next Steps:</div>
            <div class="text-sm text-gray-300 leading-relaxed">`;
        
        if (json.action === 'RESTOCK_URGENT') {
            response += `• <strong>Immediate action required</strong> to avoid stockout<br>`;
            response += `• Place order for ${json.recommendedQuantity || 'recommended'} units<br>`;
            response += `• Monitor lead time (ensure delivery before stock runs out)`;
        } else if (json.action === 'RESTOCK_NORMAL') {
            response += `• Schedule regular restock order<br>`;
            response += `• Order ${json.recommendedQuantity || 'recommended'} units<br>`;
            response += `• Review demand trends before next order`;
        } else if (json.action === 'HOLD') {
            response += `• Monitor inventory levels closely<br>`;
            response += `• Watch for demand changes or trends<br>`;
            response += `• Re-evaluate if conditions change`;
        } else if (json.action === 'DISCOUNT_TO_CLEAR') {
            response += `• Implement clearance pricing strategy<br>`;
            response += `• Reduce holding costs by selling excess<br>`;
            response += `• Consider bundling with popular items`;
        }
        
        response += `</div></div>`;
        response += `</div>`;
        
        return response;
    }
    
    // Format general analysis
    if (json.analysis || json.recommendation) {
        let response = '<div class="space-y-3">';
        if (json.analysis) response += `<div><div class="font-bold mb-1">📊 Analysis:</div><div class="text-sm">${json.analysis}</div></div>`;
        if (json.recommendation) response += `<div><div class="font-bold mb-1">💡 Recommendation:</div><div class="text-sm">${json.recommendation}</div></div>`;
        response += '</div>';
        return response;
    }
    
    // Default: pretty print JSON
    return '<pre class="text-xs bg-gray-800/50 p-3 rounded-lg overflow-x-auto">' + 
           JSON.stringify(json, null, 2) + '</pre>';
}
