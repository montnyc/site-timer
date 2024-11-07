// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeBanner);
} else {
    initializeBanner();
}

// Site-specific positioning configurations
const SITE_CONFIGS = {
    'twitter.com': {
        headerSelector: 'header[role="banner"]',
        mainContentSelector: 'main[role="main"]',
        additionalStyles: `
            #mindful-browse-wrapper {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                z-index: 2147483646;
                height: 0;
                pointer-events: none;
            }
            #mindful-browse-banner {
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(8px);
                padding: 6px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 13px;
                color: #fff;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 28px;
                box-sizing: border-box;
                pointer-events: auto;
                transform: translateY(0);
                transition: transform 0.2s ease;
            }
            #mindful-browse-banner.hidden {
                transform: translateY(-100%);
            }
            .mindful-browse-content {
                display: flex;
                justify-content: center;
                gap: 8px;
                line-height: 16px;
            }
            .mindful-browse-time {
                font-weight: 500;
                font-variant-numeric: tabular-nums;
            }
            .mindful-browse-limit {
                opacity: 0.8;
            }
        `
    },
    'x.com': {
        inheritFrom: 'twitter.com'
    },
    'default': {
        additionalStyles: `
            #mindful-browse-wrapper {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                z-index: 2147483646;
                pointer-events: none;
            }
            #mindful-browse-banner {
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(8px);
                padding: 8px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 13px;
                border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                display: flex;
                align-items: center;
                pointer-events: auto;
            }
            .mindful-browse-content {
                width: 100%;
                max-width: 600px;
                margin: 0 auto;
                display: flex;
                justify-content: center;
                gap: 12px;
                color: #4A4036;
                line-height: 16px;
            }
            .mindful-browse-time {
                font-weight: 500;
                font-variant-numeric: tabular-nums;
            }
            .mindful-browse-limit {
                color: #8B7355;
            }
        `
    }
};

function getSiteConfig() {
    const hostname = window.location.hostname.replace('www.', '');
    let config = SITE_CONFIGS[hostname];

    // Handle inheritance
    if (config && config.inheritFrom) {
        config = SITE_CONFIGS[config.inheritFrom];
    }

    return config || SITE_CONFIGS.default;
}

function initializeBanner() {
    // First check if this site is being tracked
    checkIfSiteIsTracked().then(isTracked => {
        if (isTracked) {
            setupPageForBanner();
        }
    });
}

function setupPageForBanner() {
    const config = getSiteConfig();

    // Create wrapper and banner
    const wrapper = document.createElement('div');
    wrapper.id = 'mindful-browse-wrapper';

    const banner = createTimerBanner();
    wrapper.appendChild(banner);

    // Add to document
    document.body.appendChild(wrapper);

    // Set up scroll handling for auto-hide on Twitter
    if (config.headerSelector) {
        let lastScrollY = window.scrollY;
        let headerVisible = true;

        window.addEventListener('scroll', () => {
            const currentScroll = window.scrollY;
            const header = document.querySelector(config.headerSelector);

            if (header) {
                // Check if header is visible based on its transform
                const headerTransform = window.getComputedStyle(header).transform;
                const isHeaderVisible = headerTransform === 'none' || !headerTransform.includes('matrix');

                if (headerVisible !== isHeaderVisible) {
                    headerVisible = isHeaderVisible;
                    banner.classList.toggle('hidden', !headerVisible);
                }
            }

            lastScrollY = currentScroll;
        }, { passive: true });
    }

    // Start updates
    startTimeUpdates();
}

function createTimerBanner() {
    const banner = document.createElement('div');
    banner.id = 'mindful-browse-banner';
    banner.innerHTML = `
        <div class="mindful-browse-content">
            <span class="mindful-browse-time">Loading...</span>
            <span class="mindful-browse-limit"></span>
        </div>
    `;

    // Add styles
    const config = getSiteConfig();
    const style = document.createElement('style');
    style.textContent = config.additionalStyles;
    document.head.appendChild(style);

    return banner;
}

function formatTime(minutes) {
    const totalSeconds = Math.floor(minutes * 60);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updateBanner(timeSpent, limit, lastUpdateTime) {
    const banner = document.getElementById('mindful-browse-banner');
    if (banner) {
        const timeElement = banner.querySelector('.mindful-browse-time');
        const limitElement = banner.querySelector('.mindful-browse-limit');

        // Calculate current time including seconds
        const additionalTime = (Date.now() - lastUpdateTime) / 60000;
        const currentTimeSpent = timeSpent + additionalTime;

        timeElement.textContent = formatTime(currentTimeSpent);
        limitElement.textContent = `/ ${limit}m`;
    }
}

async function checkIfSiteIsTracked() {
    return new Promise(resolve => {
        chrome.runtime.sendMessage({ type: 'getTime' }, (response) => {
            if (response) {
                updateBanner(response.timeSpent, response.limit, response.lastUpdateTime);
                resolve(true);
            } else {
                resolve(false);
            }
        });
    });
}

function startTimeUpdates() {
    setInterval(() => {
        chrome.runtime.sendMessage({ type: 'getTime' }, (response) => {
            if (response) {
                updateBanner(response.timeSpent, response.limit, response.lastUpdateTime);
            }
        });
    }, 1000);
}

// Listen for time updates and limit additions
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'timeUpdate') {
        updateBanner(message.timeSpent, message.limit, message.lastUpdateTime);
    } else if (message.type === 'limitAdded') {
        if (!document.getElementById('mindful-browse-banner')) {
            setupPageForBanner();
        }
        updateBanner(message.timeSpent, message.limit, Date.now());
    }
    sendResponse({});
    return true;
});