// ==UserScript==
// @name         Page Summarizer
// @namespace    https://github.com/kbdevs/aisearchsummary/
// @version      2024-11-16
// @description  AI-powered page text summarizer
// @author       kbdevs
// @match        *://*/*
// @icon         data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="%238C91FE" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
// @grant        none
// ==/UserScript==

(function() {
    const config = {
        apiKey: 'YOUR_API_KEY',
        model: 'gpt-4o-mini'
    };

    // Create floating icon
    const icon = document.createElement('div');
    icon.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 50px;
        height: 50px;
        background: #8C91FE;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        transition: transform 0.2s;
    `;
    icon.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-7-2h2v-2h-2v2zm0-4h2V7h-2v6z"/>
        </svg>
    `;
    document.body.appendChild(icon);

    // Create summary container
    const summaryContainer = document.createElement('div');
    summaryContainer.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 20px;
        width: 300px;
        max-height: 400px;
        background: #1F1F1F;
        border: 1px solid #3c4043;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        font-family: arial, sans-serif;
        line-height: 1.58;
        color: #e8eaed;
        font-size: 14px;
        overflow-y: auto;
        display: none;
        z-index: 10000;
        padding: 16px;
    `;
    document.body.appendChild(summaryContainer);

    // Helper function to get visible text
    function getVisibleText() {
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    if (node.parentElement.offsetParent === null) return NodeFilter.FILTER_REJECT;
                    const style = window.getComputedStyle(node.parentElement);
                    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        let text = '';
        let node;
        while (node = walker.nextNode()) {
            text += node.textContent.trim() + ' ';
        }
        return text.trim();
    }

    // Handle icon hover effect
    icon.addEventListener('mouseover', () => {
        icon.style.transform = 'scale(1.1)';
    });
    icon.addEventListener('mouseout', () => {
        icon.style.transform = 'scale(1)';
    });

    // Store summaries
    let fullSummary = '';
    let condensedSummary = '';
    let isCondensed = false;

    // Handle click
    let isOpen = false;
    icon.addEventListener('click', async () => {
        if (isOpen) {
            summaryContainer.style.display = 'none';
            isOpen = false;
            return;
        }

        isOpen = true;
        isCondensed = false;
        summaryContainer.style.display = 'block';
        summaryContainer.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 16px; height: 16px; border: 2px solid #8C91FE; border-radius: 50%; border-top-color: transparent; animation: spin 1s linear infinite;"></div>
                <div>Summarizing...</div>
            </div>
            <style>
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            </style>
        `;

        const visibleText = getVisibleText();
        
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                body: JSON.stringify({
                    model: config.model,
                    messages: [{
                        role: 'user',
                        content: `Provide a very brief, plain-text (NO MARKDOWN STYLING, JUST PLAIN TEXT) summary of the key information from this webpage text. Focus only on the most important points: ${visibleText}`
                    }],
                    stream: true
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let summary = '';

            summaryContainer.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="color: #8C91FE; font-size: 14px;">Summary</div>
                    <button id="condense-button" style="
                        background: #8C91FE;
                        color: white;
                        border: none;
                        padding: 4px 8px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                        transition: background 0.2s;
                    ">Condense</button>
                </div>
                <div id="summary-content"></div>
            `;

            // Add hover effect and click handler for condense button
            const condenseButton = document.getElementById('condense-button');
            condenseButton.addEventListener('mouseover', () => {
                condenseButton.style.background = '#7A7FE5';
            });
            condenseButton.addEventListener('mouseout', () => {
                condenseButton.style.background = '#8C91FE';
            });
            condenseButton.addEventListener('click', async () => {
                const summaryContent = document.getElementById('summary-content');
                
                if (isCondensed) {
                    // Show full summary
                    summaryContent.innerHTML = fullSummary;
                    condenseButton.textContent = 'Condense';
                    isCondensed = false;
                } else {
                    if (condensedSummary) {
                        // Use cached condensed summary
                        summaryContent.innerHTML = condensedSummary;
                        condenseButton.textContent = 'Show Full';
                        isCondensed = true;
                    } else {
                        // Generate condensed summary for the first time
                        summaryContent.innerHTML = `
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div style="width: 16px; height: 16px; border: 2px solid #8C91FE; border-radius: 50%; border-top-color: transparent; animation: spin 1s linear infinite;"></div>
                                <div>Condensing...</div>
                            </div>
                        `;
                        condenseButton.disabled = true;

                        try {
                            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${config.apiKey}`
                                },
                                body: JSON.stringify({
                                    model: config.model,
                                    messages: [{
                                        role: 'user',
                                        content: `Create an extremely concise version (about 1-2 sentences) of this summary, focusing only on the absolute key points: ${fullSummary}`
                                    }],
                                    stream: false
                                })
                            });

                            if (!response.ok) {
                                throw new Error(`API error: ${response.status}`);
                            }

                            const data = await response.json();
                            condensedSummary = data.choices[0].message.content;
                            summaryContent.innerHTML = condensedSummary;
                            condenseButton.textContent = 'Show Full';
                            isCondensed = true;
                        } catch (error) {
                            summaryContent.innerHTML = fullSummary;
                            console.error('Error condensing summary:', error);
                        }
                        condenseButton.disabled = false;
                    }
                }
            });

            const summaryContent = document.getElementById('summary-content');

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
                                summary += content;
                                summaryContent.innerHTML = summary;
                                fullSummary = summary; // Store the full summary
                            }
                        } catch (e) {
                            console.error('Error parsing chunk:', e);
                        }
                    }
                }
            }

        } catch (error) {
            summaryContainer.innerHTML = `
                <div style="color: #f28b82; padding: 8px; background: #2d2d2d; border-radius: 8px;">
                    Error: ${error.message}
                </div>
            `;
        }
    });
})();
