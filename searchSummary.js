// ==UserScript==
// @name         Search Summary
// @namespace    https://github.com/kbdevs/aisearchtools/
// @version      2024-11-16
// @description  selfhosted kinda ai search summaries
// @author       kbdevs
// @match        https://www.google.com/search*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @grant        none
// ==/UserScript==

(function() {
    // Configuration
    const config = {
        apiKey: 'YOUR_OPENAI_API_KEY',
        model: 'gpt-4o-mini',
        maxTokens: 150
    };

    // Simple Markdown parser
    function parseMarkdown(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            .replace(/^\d\. (.*$)/gm, '<ol><li>$1</li></ol>')
            .replace(/^- (.*$)/gm, '<ul><li>$1</li></ul>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
            .replace(/\n/g, '<br>');
    }

    // Validate environment
    if (!window.location.hostname.includes('google.com')) {
        alert('This bookmarklet only works on Google search pages');
        return;
    }

    if (!config.apiKey) {
        alert('Please configure your OpenAI API key first');
        return;
    }

    // Get search query
// Extract the query from the URL
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q');
    if (!searchQuery) {
        alert('Could not find search query in URL');
        return;
    }

    // Find target container
    const targetDiv = document.getElementById('center_col');
    if (!targetDiv) {
        alert('Could not find target container');
        return;
    }

    // Create and style AI response container
    let aiContainer = document.getElementById('ai-response-container');
    if (aiContainer) {
        aiContainer.remove();
    }
    aiContainer = document.createElement('div');
    aiContainer.id = 'ai-response-container';
    aiContainer.style.cssText = `
        margin: 0 0 20px 0;
        padding: 20px;
        background: #1F1F1F;
        border: 1px solid #3c4043;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        font-family: arial, sans-serif;
        line-height: 1.58;
        color: #e8eaed;
        font-size: 14px;
    `;

    // Add loading state
    aiContainer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 20px; height: 20px; border: 2.5px solid #8C91FE; border-radius: 50%; border-top-color: transparent; animation: spin 1s linear infinite;"></div>
            <div style="color: #e8eaed;">Getting AI response...</div>
        </div>
        <style>
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            #ai-response-container code {
                background: #2d2d2d;
                padding: 2px 6px;
                border-radius: 4px;
                font-family: monospace;
                font-size: 13px;
            }
            #ai-response-container h1, #ai-response-container h2, #ai-response-container h3 {
                margin: 16px 0 8px 0;
                color: #8C91FE
                font-family: arial, sans-serif;
            }
            #ai-response-container a {
                color: #8C91FE;
                text-decoration: none;
            }
            #ai-response-container a:hover {
                text-decoration: underline;
            }
            #ai-response-container ul, #ai-response-container ol {
                margin: 8px 0;
                padding-left: 24px;
            }
            #ai-response-container li {
                margin: 4px 0;
            }
            #ai-response-container .input-group {
                display: flex;
                gap: 8px;
                margin-top: 16px;
            }
            #ai-response-container .input-group input {
                flex: 1;
            }
        </style>
    `;

    // Insert container
    targetDiv.insertBefore(aiContainer, targetDiv.firstChild);

    // Define conversation history
    let messages = [{
        role: 'user',
        content: `Provide a brief, helpful response to: ${searchQuery}`
    }];

    async function queryOpenAI() {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`,
                    // Add this header to get streaming response
                    'Accept': 'text/event-stream'
                },
                body: JSON.stringify({
                    model: config.model,
                    messages: messages,
                    max_tokens: config.maxTokens,
                    stream: true // Enable streaming
                })
            });
    
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
    
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedResponse = '';
    
            // Prepare the container for streaming response
            aiContainer.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div style="font-size: 16px; color: #8C91FE;">AI Response</div>
                </div>
                <div id="streaming-content" style="color: #e8eaed; margin-bottom: 16px;"></div>
            `;
    
            const streamingContent = document.getElementById('streaming-content');
    
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
    
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const jsonData = JSON.parse(line.slice(6));
                            const content = jsonData.choices[0]?.delta?.content || '';
                            if (content) {
                                accumulatedResponse += content;
                                streamingContent.innerHTML = parseMarkdown(accumulatedResponse);
                            }
                        } catch (e) {
                            console.error('Error parsing chunk:', e);
                        }
                    }
                }
            }
    
            // After streaming is complete, add the follow-up input section
            messages.push({
                role: 'assistant',
                content: accumulatedResponse
            });
    
            aiContainer.innerHTML += `
                <div class="input-group" style="width: 90%;">
                    <input type="text" id="follow-up-input"
                           placeholder="Ask a follow-up question..."
                           style="flex: 1; height: 36px; padding: 0 12px; border: 1px solid #3c4043; border-radius: 8px; background: #202124; color: #e8eaed; font-family: arial, sans-serif; font-size: 14px; outline: none; width: calc(100% - 100px);">
                    <button id="send-button"
                            style="height: 36px; padding: 0 16px; background-color: #8C91FE; border: none; border-radius: 8px; color: #202124; cursor: pointer; font-family: arial, sans-serif; font-size: 14px; font-weight: 500;">
                        Send
                    </button>
                </div>
                <div style="margin-top: 12px; font-size: 12px; color: #9aa0a6;">
                    Powered by OpenAI
                </div>
            `;
    
            // Re-add event listeners for the follow-up input
            addInputEventListeners();
    
        } catch (error) {
            aiContainer.innerHTML = `
                <div style="color: #f28b82; display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #2d2d2d; border-radius: 8px;">
                    <div>Error: ${error.message}</div>
                    <button onclick="this.parentElement.parentElement.remove()"
                            style="background: none; border: none; color: #9aa0a6; cursor: pointer; padding: 4px 8px; font-size: 20px; line-height: 1;">
                        ×
                    </button>
                </div>
            `;
        }
    }
    
    // Helper function to add input event listeners
    function addInputEventListeners() {
        const followUpInput = document.getElementById('follow-up-input');
        const sendButton = document.getElementById('send-button');
    
        followUpInput.addEventListener('focus', () => {
            followUpInput.style.borderColor = '#8C91FE';
        });
        followUpInput.addEventListener('blur', () => {
            followUpInput.style.borderColor = '#3c4043';
        });
    
        sendButton.addEventListener('mouseover', () => {
            sendButton.style.backgroundColor = '#6769FF';
        });
        sendButton.addEventListener('mouseout', () => {
            sendButton.style.backgroundColor = '#8C91FE';
        });
    
        sendButton.addEventListener('click', () => {
            const followUpQuestion = followUpInput.value.trim();
            if (followUpQuestion) {
                messages.push({
                    role: 'user',
                    content: followUpQuestion
                });
                queryOpenAI();
            }
        });
    
        followUpInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendButton.click();
            }
        });
    }    

    // Initial query
    queryOpenAI();
})();
