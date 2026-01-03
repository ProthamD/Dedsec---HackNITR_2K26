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
            const botMessage = data.text || data.message || JSON.stringify(data);
            addMessage(botMessage, 'bot');
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
    messageDiv.className = sender === 'user' ? 'flex justify-end animate-slide-in' : 'flex justify-start animate-slide-in';
    
    const bubbleClass = sender === 'user' 
        ? 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white rounded-3xl rounded-tr-md px-7 py-5 max-w-[85%] shadow-xl'
        : 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white rounded-3xl rounded-tl-md px-7 py-5 max-w-[85%] shadow-xl';
    
    messageDiv.innerHTML = `<div class="${bubbleClass}"><p class="leading-relaxed text-base">${text}</p></div>`;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'flex justify-start animate-slide-in';
    indicator.id = 'typingIndicator';
    indicator.innerHTML = `
        <div class="bg-gray-300/80 rounded-3xl rounded-tl-md px-7 py-5 shadow-lg">
            <div class="flex gap-2">
                <span class="w-3 h-3 bg-gray-600 rounded-full animate-bounce" style="animation-delay: 0s"></span>
                <span class="w-3 h-3 bg-gray-600 rounded-full animate-bounce" style="animation-delay: 0.15s"></span>
                <span class="w-3 h-3 bg-gray-600 rounded-full animate-bounce" style="animation-delay: 0.3s"></span>
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
