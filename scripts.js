let draggedItem = null;
let draggingOverItem = null;
let isListModified = false;
let scrollInterval = null;
let markedItems = new Set();
let urlMapping = {};

// Load saved items and URL mapping when page loads
window.addEventListener('load', function() {
    loadUrlMapping();
    
    // Check for hash fragment first
    const hash = window.location.hash;
    if (hash.startsWith('#id_')) {
        const shortId = hash.substring(1);
        const encodedRanking = urlMapping[shortId];
        
        if (encodedRanking) {
            const orderedRows = JSON.parse(decodeURIComponent(encodedRanking));
            document.getElementById('inputWords').value = orderedRows.join('\n');
            importWords();
            return;
        }
    }
    
    // Fall back to saved items
    const savedItems = localStorage.getItem('rowSorterItems');
    if (savedItems) {
        document.getElementById('inputWords').value = savedItems;
        importWords();
    }
});

// Import rows from textarea and display them in the list
function importWords() {
    const textArea = document.getElementById('inputWords').value;
    const rowsArray = textArea.split('\n').filter(row => row.trim().length > 0);

    if (isListModified && !confirm("You have unsaved changes. Do you really want to reset the list?")) {
        return;
    }

    const wordList = document.getElementById('wordList');
    wordList.innerHTML = '';
    markedItems = new Set();

    rowsArray.forEach((row, index) => {
        const rowElement = createWordItem(row, index);
        wordList.appendChild(rowElement);
    });

    saveItemsToCache();
}

// Create a word item element with all necessary event listeners
function createWordItem(row, index) {
    const rowElement = document.createElement('div');
    rowElement.classList.add('word-item');
    rowElement.setAttribute('draggable', true);

    // Create text wrapper
    const textWrapper = document.createElement('div');
    textWrapper.classList.add('text-wrapper');

    const numberElement = document.createElement('span');
    numberElement.classList.add('word-item-number');
    numberElement.textContent = `${index + 1}.`;

    const textElement = document.createElement('span');
    textElement.textContent = row;

    textWrapper.appendChild(numberElement);
    textWrapper.appendChild(textElement);

    // Create button group
    const buttonGroup = document.createElement('div');
    buttonGroup.classList.add('button-group');

    const buttons = [
        { text: '▲', title: 'Move Up', action: () => moveUp(rowElement) },
        { text: '▼', title: 'Move Down', action: () => moveDown(rowElement) },
        { text: ' ⊼ ', title: 'Move to Top', action: () => moveToTop(rowElement) },
        { text: ' ⊻ ', title: 'Move to Bottom', action: () => moveToBottom(rowElement) }
    ];

    buttons.forEach(btn => {
        const button = document.createElement('button');
        button.textContent = btn.text;
        button.classList.add('move-button');
        button.title = btn.title;
        button.addEventListener('click', btn.action);
        buttonGroup.appendChild(button);
    });

    rowElement.appendChild(textWrapper);
    rowElement.appendChild(buttonGroup);

    // Add event listeners
    addDragEventListeners(rowElement);
    rowElement.addEventListener('contextmenu', handleRightClick);

    return rowElement;
}

// Add all drag-related event listeners to an element
function addDragEventListeners(element) {
    const wordList = document.getElementById('wordList');
    
    element.addEventListener('dragstart', function() {
        draggedItem = element;
        setTimeout(() => element.classList.add('draggable'), 0);
    });

    element.addEventListener('dragend', function() {
        setTimeout(() => element.classList.remove('draggable'), 0);
        draggedItem = null;
        clearInterval(scrollInterval);
        updateItemNumbers();
        saveItemsToCache();
    });

    element.addEventListener('dragover', function(e) {
        e.preventDefault();
        draggingOverItem = element;
        const bounding = element.getBoundingClientRect();
        const offset = bounding.y + bounding.height / 2;
        
        // Apply gradient effect based on mouse position
        const gradient = e.clientY < offset ? 
            'linear-gradient(to bottom, rgba(66, 153, 225, 0.2), transparent)' :
            'linear-gradient(to top, rgba(66, 153, 225, 0.2), transparent)';
        element.style['background-image'] = gradient;

        // Handle auto-scrolling
        handleAutoScroll(e, wordList);
    });

    element.addEventListener('dragleave', function() {
        element.style['background-image'] = '';
        element.style['border-bottom'] = '';
        element.style['border-top'] = '';
    });

    element.addEventListener('drop', function(e) {
        e.preventDefault();
        element.style['background-image'] = '';
        element.style['border-bottom'] = '';
        element.style['border-top'] = '';

        if (draggedItem !== element) {
            const bounding = element.getBoundingClientRect();
            const offset = bounding.y + bounding.height / 2;

            if (e.clientY < offset) {
                element.insertAdjacentElement('beforebegin', draggedItem);
            } else {
                element.insertAdjacentElement('afterend', draggedItem);
            }

            highlightRecentlyPlaced(draggedItem);
            isListModified = true;
        }
    });
}

// Handle auto-scrolling during drag
function handleAutoScroll(e, wordList) {
    const scrollThreshold = 50;
    const wordListBounding = wordList.getBoundingClientRect();

    if (e.clientY < wordListBounding.top + scrollThreshold) {
        wordList.scrollBy(0, -10);
        startScroll();
    } else if (e.clientY > wordListBounding.bottom - scrollThreshold) {
        wordList.scrollBy(0, 10);
        startScroll();
    } else {
        clearInterval(scrollInterval);
    }
}

// Start scrolling function
function startScroll() {
    if (!scrollInterval) {
        scrollInterval = setInterval(() => {
            const bounding = draggingOverItem.getBoundingClientRect();
            if (bounding.top < 0) {
                document.getElementById('wordList').scrollBy(0, -10);
            } else if (bounding.bottom > window.innerHeight) {
                document.getElementById('wordList').scrollBy(0, 10);
            }
        }, 100);
    }
}

// Add highlight effect to recently placed items
function highlightRecentlyPlaced(item) {
    document.querySelectorAll('.word-item').forEach(el => {
        el.classList.remove('recently-placed');
    });
    
    item.classList.add('recently-placed');
    setTimeout(() => {
        item.classList.remove('recently-placed');
    }, 2000);
}

// Update item numbers after reordering
function updateItemNumbers() {
    const wordItems = document.querySelectorAll('.word-item');
    wordItems.forEach((item, index) => {
        item.querySelector('.word-item-number').textContent = `${index + 1}.`;
    });
}

// Export the reordered list of rows to the output text area
function exportWords() {
    const showNumbers = document.getElementById('showNumbersToggle').checked;
    const wordElements = document.querySelectorAll('.word-item');
    const orderedRows = Array.from(wordElements).map((item, index) => {
        const text = item.querySelector('span:nth-child(2)').textContent;
        return showNumbers ? `${index + 1}. ${text}` : text;
    });
    document.getElementById('outputWords').value = orderedRows.join('\n');
}

// Save items to browser's local storage
function saveItemsToCache() {
    const wordElements = document.querySelectorAll('.word-item');
    const items = Array.from(wordElements).map(item => 
        item.querySelector('span:last-child').textContent
    );
    localStorage.setItem('rowSorterItems', items.join('\n'));
}

// Generic move function to reduce code duplication
function moveItem(item, insertMethod) {
    const wordList = document.getElementById('wordList');
    insertMethod(wordList, item);
    
    updateItemNumbers();
    isListModified = true;
    saveItemsToCache();
    highlightRecentlyPlaced(item, 1000);
    scrollIntoView(item);
}

function moveToTop(item) {
    moveItem(item, (wordList, item) => wordList.prepend(item));
}

function moveToBottom(item) {
    moveItem(item, (wordList, item) => wordList.appendChild(item));
}

function moveUp(item) {
    const previousItem = item.previousElementSibling;
    if (previousItem) {
        moveItem(item, () => previousItem.insertAdjacentElement('beforebegin', item));
    }
}

function moveDown(item) {
    const nextItem = item.nextElementSibling;
    if (nextItem) {
        moveItem(item, () => nextItem.insertAdjacentElement('afterend', item));
    }
}

// Scroll item into view
function scrollIntoView(item) {
    item.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
    });
}

// Handle right-click to mark/unmark items
function handleRightClick(event) {
    event.preventDefault();
    const wordItem = event.currentTarget;
    
    if (markedItems.has(wordItem)) {
        wordItem.style.backgroundColor = '';
        markedItems.delete(wordItem);
    } else {
        wordItem.style.backgroundColor = '#216e39';
        markedItems.add(wordItem);
    }
    
    isListModified = true;
    saveItemsToCache();
}

// Helper function to generate gradient colors
function generateGradientColor(startColor, endColor, percent) {
    const start = parseInt(startColor.slice(1), 16);
    const end = parseInt(endColor.slice(1), 16);

    const r = Math.floor((start >> 16) * (1 - percent) + (end >> 16) * percent);
    const g = Math.floor(((start >> 8) & 0xff) * (1 - percent) + ((end >> 8) & 0xff) * percent);
    const b = Math.floor((start & 0xff) * (1 - percent) + (end & 0xff) * percent);

    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// Color picker update functions
function updateTextColor() {
    const color = document.getElementById('textColorPicker').value;
    document.querySelectorAll('.result-item').forEach(item => {
        item.style.color = color;
    });
}

function updatePanelBgColor() {
    const hexColor = document.getElementById('panelBgColorPicker').value;
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    
    document.getElementById('resultsGrid').style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.8)`;
}

function toggleGradientMode() {
    const isGradual = document.getElementById('gradientModeToggle').checked;
    showResults(isGradual);
}

// Show results with gradient coloring
function showResults(isGradual = false) {
    const resultsSection = document.getElementById('resultsSection');
    const resultsGrid = document.getElementById('resultsGrid');
    
    if (!resultsGrid) {
        console.error('Results grid element not found.');
        return;
    }

    const startColor = document.getElementById('startColorPicker').value;
    const endColor = document.getElementById('endColorPicker').value;
    resultsGrid.innerHTML = '';

    const wordElements = document.querySelectorAll('.word-item');
    const totalItems = wordElements.length;

    const orderedRows = Array.from(wordElements).map((item, index) => {
        const percent = isGradual ? 
            Math.floor(index / 10) / (totalItems / 10) : 
            index / (totalItems - 1);
        
        const backgroundColor = generateGradientColor(startColor, endColor, percent);

        return `<div class="result-item" style="background-color: ${backgroundColor}">
                    <span class="result-number">${index + 1}.</span>
                    <span>${item.querySelector('span:nth-child(2)').textContent}</span>
                </div>`;
    });

    resultsGrid.innerHTML = orderedRows.join('');
    resultsSection.classList.remove('hidden');
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// URL shortening functionality
function loadUrlMapping() {
    const savedMapping = localStorage.getItem('urlMapping');
    if (savedMapping) {
        urlMapping = JSON.parse(savedMapping);
    }
}

function saveUrlMapping() {
    localStorage.setItem('urlMapping', JSON.stringify(urlMapping));
}

function generateShortId() {
    return 'id_' + Math.random().toString(36).substr(2, 8);
}

function shareRanking() {
    const wordElements = document.querySelectorAll('.word-item');
    const orderedRows = Array.from(wordElements).map(item => 
        item.querySelector('span:last-child').textContent
    );
    
    const encodedRanking = encodeURIComponent(JSON.stringify(orderedRows));
    
    // Find existing short ID or create new one
    let shortId = Object.keys(urlMapping).find(id => urlMapping[id] === encodedRanking);
    
    if (!shortId) {
        shortId = generateShortId();
        urlMapping[shortId] = encodedRanking;
        saveUrlMapping();
    }
    
    const currentURL = window.location.href.split('#')[0];
    const shareableURL = `${currentURL}#${shortId}`;
    
    navigator.clipboard.writeText(shareableURL).then(() => {
        alert('Short Ranking URL copied to clipboard: ' + shareableURL);
    }).catch(err => {
        console.error('Could not copy text: ', err);
    });
}

function switchMode(mode) {
    const rankerTab = document.getElementById('rankerTab');
    const tierTab = document.getElementById('tierTab');
    const rankerMode = document.getElementById('rankerMode');
    const tierMode = document.getElementById('tierMode');

    if (mode === 'ranker') {
        rankerTab.classList.add('active');
        tierTab.classList.remove('active');
        rankerMode.classList.remove('hidden');
        tierMode.classList.add('hidden');
    } else {
        tierTab.classList.add('active');
        rankerTab.classList.remove('active');
        tierMode.classList.remove('hidden');
        rankerMode.classList.add('hidden');
    }
}

function randomizeList() {
    if (!confirm("Are you sure you want to randomize the list? This will overwrite the current order.")) {
        return;
    }

    const wordList = document.getElementById('wordList');
    const items = Array.from(wordList.children);

    // Fisher–Yates shuffle
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }

    // Re-append shuffled items
    items.forEach(item => wordList.appendChild(item));

    updateItemNumbers();
    isListModified = true;
    saveItemsToCache();
}

// Tier functionality
const tierNames = ['S', 'A', 'B', 'C', 'D'];

// Load saved tier data when page loads
window.addEventListener('load', function() {
    loadUrlMapping();
    
    // Check for hash fragment first
    const hash = window.location.hash;
    if (hash.startsWith('#id_')) {
        const shortId = hash.substring(1);
        const encodedRanking = urlMapping[shortId];
        
        if (encodedRanking) {
            const orderedRows = JSON.parse(decodeURIComponent(encodedRanking));
            document.getElementById('inputWords').value = orderedRows.join('\n');
            importWords();
            return;
        }
    }
    
    // Fall back to saved items
    const savedItems = localStorage.getItem('rowSorterItems');
    if (savedItems) {
        document.getElementById('inputWords').value = savedItems;
        importWords();
    }
    
    // Load saved tier data
    loadTierDataFromCache();
});

function importToTiers() {
    const input = document.getElementById('tierInput').value.trim().split('\n').filter(Boolean);
    const itemPool = document.getElementById('itemPool');
    
    // Clear existing items
    itemPool.innerHTML = '';
    
    // Clear all tier contents
    tierNames.forEach(tier => {
        const tierContent = document.querySelector(`[data-tier="${tier}"]`);
        if (tierContent) {
            tierContent.innerHTML = '';
        }
    });

    // Add items to the pool
    input.forEach(song => {
        const item = document.createElement('div');
        item.className = 'pool-item';
        item.draggable = true;
        item.textContent = song.trim();
        
        // Add drag event listeners
        addTierDragListeners(item);
        
        itemPool.appendChild(item);
    });
    
    // Setup drop zones
    setupTierDropZones();
    
    // Save to cache
    saveTierDataToCache();
}

// Save tier data to localStorage
function saveTierDataToCache() {
    const tierData = {
        pool: [],
        tiers: {}
    };
    
    // Save items in pool
    const poolItems = document.querySelectorAll('#itemPool .pool-item');
    tierData.pool = Array.from(poolItems).map(item => item.textContent.trim());
    
    // Save items in each tier
    tierNames.forEach(tier => {
        const tierContent = document.querySelector(`[data-tier="${tier}"]`);
        const tierItems = tierContent.querySelectorAll('.tier-item');
        tierData.tiers[tier] = Array.from(tierItems).map(item => item.textContent.trim());
    });
    
    localStorage.setItem('tierListData', JSON.stringify(tierData));
}

// Load tier data from localStorage
function loadTierDataFromCache() {
    const savedTierData = localStorage.getItem('tierListData');
    if (!savedTierData) return;
    
    try {
        const tierData = JSON.parse(savedTierData);
        const itemPool = document.getElementById('itemPool');
        
        // Clear existing content
        itemPool.innerHTML = '';
        tierNames.forEach(tier => {
            const tierContent = document.querySelector(`[data-tier="${tier}"]`);
            if (tierContent) {
                tierContent.innerHTML = '';
            }
        });
        
        // Restore pool items
        if (tierData.pool) {
            tierData.pool.forEach(songText => {
                const item = document.createElement('div');
                item.className = 'pool-item';
                item.draggable = true;
                item.textContent = songText;
                addTierDragListeners(item);
                itemPool.appendChild(item);
            });
        }
        
        // Restore tier items
        if (tierData.tiers) {
            tierNames.forEach(tier => {
                if (tierData.tiers[tier]) {
                    const tierContent = document.querySelector(`[data-tier="${tier}"]`);
                    tierData.tiers[tier].forEach(songText => {
                        const item = document.createElement('div');
                        item.className = 'tier-item';
                        item.draggable = true;
                        item.textContent = songText;
                        applyTierColor(item, tier);
                        addTierDragListeners(item);
                        tierContent.appendChild(item);
                    });
                }
            });
        }
        
        // Setup drop zones
        setupTierDropZones();
        
        // Update input textarea to show all items
        const allItems = [...tierData.pool];
        tierNames.forEach(tier => {
            if (tierData.tiers[tier]) {
                allItems.push(...tierData.tiers[tier]);
            }
        });
        document.getElementById('tierInput').value = allItems.join('\n');
        
    } catch (e) {
        console.error('Error loading tier data from cache:', e);
    }
}

function addTierDragListeners(item) {
    item.addEventListener('dragstart', function(e) {
        draggedItem = this;
        e.dataTransfer.effectAllowed = 'move';
    });
    
    item.addEventListener('dragend', function() {
        draggedItem = null;
        // Remove drag-over effects from all zones
        document.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
    });
}

function setupTierDropZones() {
    const itemPool = document.getElementById('itemPool');
    const tierContents = document.querySelectorAll('.tier-content');
    
    // Setup item pool as drop zone
    setupDropZone(itemPool, 'pool');
    
    // Setup tier contents as drop zones
    tierContents.forEach(tierContent => {
        setupDropZone(tierContent, 'tier');
    });
}

function setupDropZone(element, type) {
    element.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        this.classList.add('drag-over');
    });
    
    element.addEventListener('dragleave', function(e) {
        // Only remove drag-over if we're actually leaving the element
        if (!this.contains(e.relatedTarget)) {
            this.classList.remove('drag-over');
        }
    });
    
    element.addEventListener('drop', function(e) {
        e.preventDefault();
        this.classList.remove('drag-over');
        
        if (draggedItem) {
            // Change class and color based on destination
            if (type === 'pool') {
                draggedItem.className = 'pool-item';
                draggedItem.style.backgroundColor = '#4a5568'; // Default pool color
            } else {
                draggedItem.className = 'tier-item';
                // Apply tier-specific color
                const tier = this.getAttribute('data-tier');
                applyTierColor(draggedItem, tier);
            }
            
            this.appendChild(draggedItem);
            
            // Save to cache after any change
            saveTierDataToCache();
        }
    });
}

// Function to apply tier-specific colors to items
function applyTierColor(item, tier) {
    const tierColors = {
        'S': '#dc2626', // Bright Red
        'A': '#ea580c', // Red-Orange
        'B': '#d97706', // Orange-Gold
        'C': '#ca8a04', // Yellow-Gold
        'D': '#65a30d'  // Yellow-Green
    };
    
    const color = tierColors[tier] || '#4a5568'; // Default gray if tier not found
    item.style.backgroundColor = color;
}

function exportTierList() {
    const tierList = {};
    
    // Get items from each tier
    tierNames.forEach(tier => {
        const tierContent = document.querySelector(`[data-tier="${tier}"]`);
        const items = tierContent.querySelectorAll('.tier-item');
        tierList[tier] = Array.from(items).map(el => el.textContent.trim());
    });
    
    // Get items still in pool
    const poolItems = document.querySelectorAll('.pool-item');
    const unranked = Array.from(poolItems).map(el => el.textContent.trim());
    
    let output = '';
    for (const tier of tierNames) {
        if (tierList[tier].length > 0) {
            output += `${tier} Tier:\n${tierList[tier].join('\n')}\n\n`;
        }
    }
    
    if (unranked.length > 0) {
        output += `Unranked:\n${unranked.join('\n')}\n\n`;
    }

    document.getElementById('tierOutput').value = output.trim();
}


// Event listeners setup
document.addEventListener('DOMContentLoaded', function() {
    // Color picker event listeners
    document.getElementById('startColorPicker').addEventListener('input', toggleGradientMode);
    document.getElementById('endColorPicker').addEventListener('input', toggleGradientMode);
    document.getElementById('textColorPicker').addEventListener('input', updateTextColor);
    document.getElementById('panelBgColorPicker').addEventListener('input', updatePanelBgColor);
    document.getElementById('gradientModeToggle').addEventListener('change', toggleGradientMode);
    
    // Share button (if it exists)
    const shareButton = document.getElementById('shareButton');
    if (shareButton) {
        shareButton.addEventListener('click', shareRanking);
    }
});