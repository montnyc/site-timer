document.addEventListener('DOMContentLoaded', () => {
    // Tab switching logic
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab, .tab-content').forEach(el => el.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    // Website limits functionality
    const websiteInput = document.getElementById('website');
    const timeLimitInput = document.getElementById('timeLimit');
    const addButton = document.getElementById('addLimit');
    const limitsList = document.getElementById('limitsList');

    // Load existing limits
    chrome.storage.local.get(['limits'], (result) => {
        const limits = result.limits || {};
        updateLimitsList(limits);
    });

    // Add new limit
    addButton.addEventListener('click', () => {
        const website = websiteInput.value.toLowerCase();
        const timeLimit = parseInt(timeLimitInput.value);

        if (website && timeLimit) {
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
                });
            });
        }
    });

    function updateLimitsList(limits) {
        limitsList.innerHTML = '';
        Object.entries(limits).forEach(([website, data]) => {
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
        <span>${website}: ${data.timeSpent}/${data.limit} minutes</span>
        <button onclick="removeLimit('${website}')">Remove</button>
      `;
            limitsList.appendChild(item);
        });
    }

    // Quotes functionality
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

    // Load existing quotes
    chrome.storage.local.get(['quotes'], (result) => {
        const quotes = result.quotes || defaultQuotes;
        updateQuotesList(quotes);
    });

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

    function updateQuotesList(quotes) {
        quotesList.innerHTML = '';
        quotes.forEach((quote, index) => {
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
        <span>"${quote.text}"${quote.author ? ` - ${quote.author}` : ''}</span>
        <button onclick="removeQuote(${index})">Remove</button>
      `;
            quotesList.appendChild(item);
        });
    }

    // Remove limit
    window.removeLimit = function (website) {
        chrome.storage.local.get(['limits'], (result) => {
            const limits = result.limits || {};
            delete limits[website];
            chrome.storage.local.set({ limits }, () => {
                updateLimitsList(limits);
            });
        });
    };

    // Remove quote
    window.removeQuote = function (index) {
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
    };
});