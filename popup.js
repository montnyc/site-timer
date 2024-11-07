document.addEventListener('DOMContentLoaded', () => {
    // Tab switching logic
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab, .tab-content').forEach(el => el.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    const websiteInput = document.getElementById('website');
    const timeLimitInput = document.getElementById('timeLimit');
    const addButton = document.getElementById('addLimit');
    const limitsList = document.getElementById('limitsList');
    const newQuoteInput = document.getElementById('newQuote');
    const quoteAuthorInput = document.getElementById('quoteAuthor');
    const addQuoteButton = document.getElementById('addQuote');
    const quotesList = document.getElementById('quotesList');

    // Default quotes
    const defaultQuotes = [
        { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
        { text: "Time you enjoy wasting is not wasted time.", author: "Marthe Troly-Curtin" },
        { text: "Life is what happens while you're busy making other plans.", author: "John Lennon" },
        { text: "The future depends on what you do today.", author: "Mahatma Gandhi" },
        { text: "Time is the most valuable thing a man can spend.", author: "Theophrastus" }
    ];

    // Load existing limits
    function loadLimits() {
        chrome.storage.local.get(['limits'], (result) => {
            const limits = result.limits || {};
            updateLimitsList(limits);
        });
    }

    // Add new limit
    addButton.addEventListener('click', () => {
        let website = websiteInput.value.toLowerCase().trim();
        const timeLimit = parseInt(timeLimitInput.value);

        if (website && timeLimit) {
            // Remove common prefixes and paths
            website = website.replace(/^(https?:\/\/)?(www\.)?/, '');
            website = website.split('/')[0];  // Remove any paths

            chrome.storage.local.get(['limits'], (result) => {
                const limits = result.limits || {};
                limits[website] = {
                    limit: timeLimit,
                    timeSpent: 0,
                    lastReset: new Date().toDateString()
                };

                chrome.storage.local.set({ limits }, () => {
                    updateLimitsList(limits);
                    websiteInput.value = '';
                    timeLimitInput.value = '';

                    // Notify all tabs with this domain
                    chrome.tabs.query({}, (tabs) => {
                        tabs.forEach(tab => {
                            try {
                                const tabHostname = new URL(tab.url).hostname.replace(/^www\./, '');
                                if (tabHostname === website) {
                                    chrome.tabs.sendMessage(tab.id, {
                                        type: 'limitAdded',
                                        timeSpent: 0,
                                        limit: timeLimit
                                    });
                                }
                            } catch (e) {
                                console.error('Error processing tab:', e);
                            }
                        });
                    });
                });
            });
        }
    });

    // Update limits list
    function updateLimitsList(limits) {
        limitsList.innerHTML = '';
        Object.entries(limits).forEach(([website, data]) => {
            const item = document.createElement('div');
            item.className = 'list-item';

            const textSpan = document.createElement('span');
            textSpan.textContent = `${website}: ${Math.round(data.timeSpent * 10) / 10}/${data.limit} minutes`;

            const removeButton = document.createElement('button');
            removeButton.textContent = 'Remove';
            removeButton.addEventListener('click', () => removeLimit(website));

            item.appendChild(textSpan);
            item.appendChild(removeButton);
            limitsList.appendChild(item);
        });
    }

    // Remove limit
    function removeLimit(website) {
        chrome.storage.local.get(['limits'], (result) => {
            const limits = result.limits || {};
            delete limits[website];
            chrome.storage.local.set({ limits }).then(() => {
                updateLimitsList(limits);
            });
        });
    }

    // Load existing quotes
    function loadQuotes() {
        chrome.storage.local.get(['quotes'], (result) => {
            const quotes = result.quotes || defaultQuotes;
            updateQuotesList(quotes);
        });
    }

    // Add new quote
    addQuoteButton.addEventListener('click', () => {
        const text = newQuoteInput.value.trim();
        const author = quoteAuthorInput.value.trim();

        if (text) {
            chrome.storage.local.get(['quotes'], (result) => {
                const quotes = result.quotes || defaultQuotes;
                quotes.push({ text, author });

                chrome.storage.local.set({ quotes }, () => {
                    updateQuotesList(quotes);
                    newQuoteInput.value = '';
                    quoteAuthorInput.value = '';
                });
            });
        }
    });

    // Update quotes list
    function updateQuotesList(quotes) {
        quotesList.innerHTML = '';
        quotes.forEach((quote, index) => {
            const item = document.createElement('div');
            item.className = 'list-item';

            const textSpan = document.createElement('span');
            textSpan.textContent = `"${quote.text}"${quote.author ? ` - ${quote.author}` : ''}`;

            const removeButton = document.createElement('button');
            removeButton.textContent = 'Remove';
            removeButton.addEventListener('click', () => removeQuote(index));

            item.appendChild(textSpan);
            item.appendChild(removeButton);
            quotesList.appendChild(item);
        });
    }

    // Remove quote
    function removeQuote(index) {
        chrome.storage.local.get(['quotes'], (result) => {
            const quotes = result.quotes || defaultQuotes;
            quotes.splice(index, 1);
            if (quotes.length === 0) {
                quotes.push(...defaultQuotes);
            }
            chrome.storage.local.set({ quotes }, () => {
                updateQuotesList(quotes);
            });
        });
    }

    // Initial load
    loadLimits();
    loadQuotes();
});