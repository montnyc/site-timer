// Create and insert the banner
function createTimerBanner() {
    if (document.getElementById('mindful-browse-banner')) {
        return; // Banner already exists
    }

    const banner = document.createElement('div');
    banner.id = 'mindful-browse-banner';
    banner.innerHTML = `
    <div class="mindful-browse-content">
      <span class="mindful-browse-time">Loading...</span>
      <span class="mindful-browse-limit"></span>
    </div>
  `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
    #mindful-browse-banner {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(8px);
      z-index: 2147483647;
      padding: 8px;
      font-family: "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      transition: all 0.3s ease;
      height: 36px;
      box-sizing: border-box;
      display: flex;
      align-items: center;
    }
    .mindful-browse-content {
      max-width: 600px;
      margin: 0 auto;
      display: flex;
      justify-content: center;
      gap: 12px;
      color: #4A4036;
    }
    .mindful-browse-time {
      font-weight: 500;
    }
    .mindful-browse-limit {
      color: #8B7355;
    }
  `;

    // Function to handle Twitter's specific layout
    function handleTwitterLayout() {
        const mainContent = document.querySelector('main');
        if (mainContent) {
            const currentMargin = parseInt(window.getComputedStyle(mainContent).marginTop);
            mainContent.style.marginTop = (currentMargin + 36) + 'px';
        }

        // Handle Twitter's fixed header
        const header = document.querySelector('header[role="banner"]');
        if (header) {
            header.style.top = '36px';
        }
    }

    // Insert the banner and apply styles
    document.head.appendChild(style);

    // For Twitter/X, insert before the first child of body
    const body = document.body;
    if (body) {
        body.insertBefore(banner, body.firstChild);
        if (window.location.hostname.includes('twitter.com') ||
            window.location.hostname.includes('x.com')) {
            handleTwitterLayout();
        } else {
            // For other sites, add margin to body
            body.style.marginTop = '36px';
        }
    }

    return banner;
}

// Update the banner with current time
function updateBanner(timeSpent, limit) {
    const banner = document.getElementById('mindful-browse-banner');
    if (banner) {
        const timeElement = banner.querySelector('.mindful-browse-time');
        const limitElement = banner.querySelector('.mindful-browse-limit');

        // Format time consistently with popup (1 decimal place)
        const timeSpentFormatted = (Math.floor(timeSpent * 10) / 10).toFixed(1);
        timeElement.textContent = `${timeSpentFormatted} minutes`;
        limitElement.textContent = `/ ${limit} minute limit`;
    }
}

// First check if this site is being tracked
async function checkIfSiteIsTracked() {
    return new Promise(resolve => {
        chrome.runtime.sendMessage({ type: 'getTime' }, (response) => {
            if (response) {
                // If we get time data back, immediately create and update banner
                createTimerBanner();
                updateBanner(response.timeSpent, response.limit);
            }
            resolve(!!response);
        });
    });
}

// Listen for time updates and limit additions
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'timeUpdate') {
        updateBanner(message.timeSpent, message.limit);
    } else if (message.type === 'limitAdded') {
        if (!document.getElementById('mindful-browse-banner')) {
            createTimerBanner();
        }
        updateBanner(message.timeSpent, message.limit);
    }
    sendResponse({});
    return true;
});

// Initialize banner
checkIfSiteIsTracked();