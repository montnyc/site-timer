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
    const tab = await chrome.tabs.get(activeInfo.tabId);
    handleTabChange(tab.url, tab.id);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        handleTabChange(changeInfo.url, tabId);
    }
});

async function handleTabChange(url, tabId) {
    if (activeTabInfo.url && activeTabInfo.startTime) {
        await updateTimeSpent(activeTabInfo.url, activeTabInfo.startTime);
    }

    const hostname = new URL(url).hostname;
    activeTabInfo = {
        url: hostname,
        startTime: Date.now()
    };

    // Check if we should block the page immediately
    checkAndBlockIfNeeded(hostname, tabId);
}

async function updateTimeSpent(hostname, startTime) {
    const timeSpent = Math.floor((Date.now() - startTime) / 60000); // Convert to minutes

    const { limits } = await chrome.storage.local.get(['limits']);
    if (limits?.[hostname]) {
        limits[hostname].timeSpent += timeSpent;
        await chrome.storage.local.set({ limits });

        // Check if limit exceeded
        if (limits[hostname].timeSpent >= limits[hostname].limit) {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icon48.png',
                title: 'Time Limit Reached',
                message: `You've reached your daily limit for ${hostname}`
            });

            // Find and block all tabs with this hostname
            const tabs = await chrome.tabs.query({});
            tabs.forEach(tab => {
                if (tab.url && tab.url.includes(hostname)) {
                    replacePageContent(tab.id);
                }
            });
        }
    }
}

async function checkAndBlockIfNeeded(hostname, tabId) {
    const { limits } = await chrome.storage.local.get(['limits']);
    if (limits?.[hostname] && limits[hostname].timeSpent >= limits[hostname].limit) {
        replacePageContent(tabId);
    }
}

async function replacePageContent(tabId) {
    const { quotes } = await chrome.storage.local.get(['quotes']);
    const allQuotes = quotes || defaultQuotes;
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

    try {
        await chrome.scripting.insertCSS({
            target: { tabId },
            css: css
        });

        await chrome.scripting.executeScript({
            target: { tabId },
            func: (html) => {
                document.body.innerHTML = html;
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