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