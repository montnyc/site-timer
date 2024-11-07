let activeTabInfo = {
    url: null,
    startTime: null
};

// Check for time limits every minute
chrome.alarms.create('checkTimeLimit', { periodInMinutes: 1 });

// Reset daily limits at midnight
chrome.alarms.create('resetDaily', {
    when: getNextMidnight(),
    periodInMinutes: 24 * 60
});

function getNextMidnight() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return midnight.getTime();
}

// Track active tab changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.url) {
            handleTabChange(tab.url, tab.id);
        }
    } catch (error) {
        console.error('Error handling tab activation:', error);
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        handleTabChange(changeInfo.url, tabId);
    }
});

function handleTabChange(url, tabId) {
    // Ignore invalid URLs
    if (!url || !url.startsWith('http')) {
        return;
    }

    try {
        // Extract base domain
        let hostname = new URL(url).hostname;
        // Remove www. prefix if present
        hostname = hostname.replace(/^www\./, '');

        // Update time for previous tab if it exists
        if (activeTabInfo.url && activeTabInfo.startTime) {
            updateTimeSpent(activeTabInfo.url, activeTabInfo.startTime);
        }

        // Store new tab info
        activeTabInfo = {
            url: hostname,
            startTime: Date.now()
        };

        // Check if we should block the page immediately
        checkAndBlockIfNeeded(hostname, tabId);
    } catch (error) {
        console.error('Error handling tab change:', error);
    }
}

async function checkAndBlockIfNeeded(hostname, tabId) {
    try {
        const { limits } = await chrome.storage.local.get(['limits']);
        if (limits) {
            const domainToCheck = hostname.replace(/^www\./, '');
            if (limits[domainToCheck] && limits[domainToCheck].timeSpent >= limits[domainToCheck].limit) {
                await replacePageContent(tabId);
            }
        }
    } catch (error) {
        console.error('Error checking limits:', error);
    }
}

// Send time updates to content script
async function sendTimeUpdateToTab(tabId, timeSpent, limit) {
    try {
        await chrome.tabs.sendMessage(tabId, {
            type: 'timeUpdate',
            timeSpent,
            limit
        });
    } catch (error) {
        // Content script might not be loaded yet, which is fine
        console.debug('Could not send time update to tab:', error);
    }
}

// Listen for time requests from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'getTime' && sender.tab) {
        chrome.storage.local.get(['limits'], ({ limits }) => {
            if (!limits) {
                sendResponse(null);
                return;
            }

            const hostname = new URL(sender.tab.url).hostname.replace(/^www\./, '');
            const siteData = limits[hostname];

            if (siteData) {
                sendResponse({
                    timeSpent: Math.round(siteData.timeSpent),
                    limit: siteData.limit
                });
            } else {
                sendResponse(null);
            }
        });
        return true;  // Will respond asynchronously
    }
});

async function updateTimeSpent(hostname, startTime) {
    try {
        // Calculate time spent in minutes, with a minimum of 0.1 minutes (6 seconds)
        const timeSpentMs = Date.now() - startTime;
        const timeSpentMinutes = Math.max(0.1, timeSpentMs / 60000);

        const { limits } = await chrome.storage.local.get(['limits']);
        if (limits) {
            // Check all domains that could match (with or without www.)
            const domainToCheck = hostname.replace(/^www\./, '');

            if (limits[domainToCheck]) {
                // Update time spent
                limits[domainToCheck].timeSpent += timeSpentMinutes;

                // Use floor instead of round to match popup and banner display
                limits[domainToCheck].timeSpent = Math.floor(limits[domainToCheck].timeSpent * 10) / 10;

                await chrome.storage.local.set({ limits });

                // Send update to all tabs with this domain
                const tabs = await chrome.tabs.query({});
                for (const tab of tabs) {
                    if (tab.url) {
                        const tabHostname = new URL(tab.url).hostname.replace(/^www\./, '');
                        if (tabHostname === domainToCheck) {
                            await sendTimeUpdateToTab(tab.id, limits[domainToCheck].timeSpent, limits[domainToCheck].limit);
                        }
                    }
                }

                // Check if limit exceeded
                if (limits[domainToCheck].timeSpent >= limits[domainToCheck].limit) {
                    // Show notification
                    chrome.notifications.create({
                        type: 'basic',
                        iconUrl: 'icon48.png',
                        title: 'Time Limit Reached',
                        message: `You've reached your daily limit for ${domainToCheck}`
                    });

                    // Find and block all matching tabs
                    const tabs = await chrome.tabs.query({});
                    for (const tab of tabs) {
                        if (tab.url) {
                            const tabHostname = new URL(tab.url).hostname.replace(/^www\./, '');
                            if (tabHostname === domainToCheck) {
                                await replacePageContent(tab.id);
                            }
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error updating time spent:', error);
    }
}

async function replacePageContent(tabId) {
    try {
        const { quotes } = await chrome.storage.local.get(['quotes']);
        const allQuotes = quotes || [
            { text: "Time you enjoy wasting is not wasted time.", author: "Marthe Troly-Curtin" }
        ];
        const randomQuote = allQuotes[Math.floor(Math.random() * allQuotes.length)];

        const css = `
      body {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        margin: 0;
        background-color: #F5F1EB;
        font-family: "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #4A4036;
        background-image: linear-gradient(120deg, #F5F1EB 0%, #E6DFD7 100%);
      }
      .quote-container {
        text-align: center;
        max-width: 600px;
        padding: 48px;
        background: rgba(255, 255, 255, 0.8);
        border-radius: 16px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.05);
        backdrop-filter: blur(8px);
      }
      .quote-text {
        font-size: 28px;
        line-height: 1.6;
        margin-bottom: 24px;
        color: #2C3338;
        font-weight: 300;
      }
      .quote-author {
        font-style: italic;
        color: #8B7355;
      }
    `;

        const html = `
      <div class="quote-container">
        <div class="quote-text">"${randomQuote.text}"</div>
        ${randomQuote.author ? `<div class="quote-author">- ${randomQuote.author}</div>` : ''}
      </div>
    `;

        await chrome.scripting.insertCSS({
            target: { tabId },
            css: css
        });

        await chrome.scripting.executeScript({
            target: { tabId },
            func: (html) => {
                document.body.innerHTML = html;
                document.title = "Time to take a break";
            },
            args: [html]
        });
    } catch (error) {
        console.error('Failed to replace page content:', error);
    }
}

// Handle alarms
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'resetDaily') {
        chrome.storage.local.get(['limits'], (result) => {
            const limits = result.limits || {};
            Object.keys(limits).forEach(website => {
                limits[website].timeSpent = 0;
                limits[website].lastReset = new Date().toDateString();
            });
            chrome.storage.local.set({ limits });
        });
    } else if (alarm.name === 'checkTimeLimit') {
        if (activeTabInfo.url && activeTabInfo.startTime) {
            updateTimeSpent(activeTabInfo.url, activeTabInfo.startTime);
            activeTabInfo.startTime = Date.now(); // Reset start time for next check
        }
    }
});