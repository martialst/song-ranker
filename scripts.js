let draggedItem = null;
let draggingOverItem = null;
let isListModified = false;
let isTierListModified = false;
let scrollInterval = null;
let markedItems = new Set();
let urlMapping = {};
const visualScoreDefault = 5.5;
// Background images are referenced via symlinks in image/background to avoid binary duplicates.
const defaultBackgrounds = [
    { id: 'default-mountain', name: 'Mountain', src: 'image/background/mountain.png' },
    { id: 'default-snowy', name: 'Snowy Mountain', src: 'image/background/snowymountain.png' },    
    { id: 'default-winter-2', name: 'Winter Breeze', src: 'image/background/winterbg2.png' },
    { id: 'default-winter-3', name: 'Winter Night', src: 'image/background/winterbg3.png' },
    { id: 'default-background-1', name: 'Background 01', src: 'image/background/aespa-Armageddon-1st-Full-Album-Concept-Photos-documents-1.jpeg' },
    { id: 'default-background-2', name: 'Background 02', src: 'image/background/aespa-Armageddon-1st-Full-Album-Concept-Photos-documents-15(13).jpeg' },
    { id: 'default-red-velvet', name: 'Red Velvet', src: 'image/background/red-velvet-__________-rbb-really-bad-boy-mv-3-7-screenshot.png' },
    { id: 'default-xg', name: 'XG Gala', src: 'image/background/XG-1st-Full-Album-GALA-Concept-Photos-documents-4(2).jpeg' },
    { id: 'default-background-3', name: 'Background 03', src: 'image/background/0543b36dc9124c3881307f6ec4f78aed.jpg' },
    { id: 'default-background-4', name: 'Background 04', src: 'image/background/3312ae774bed4311b8678aed6c3a3f9d.jpg' },
    { id: 'default-background-5', name: 'Background 05', src: 'image/background/333a765093b20be35b5cffa61b26fd9b.jpg' },
    { id: 'default-background-6', name: 'Background 06', src: 'image/background/7770225be1cc4791b2bf55ca75d2e947.jpg' },
    { id: 'default-background-7', name: 'Background 07', src: 'image/background/j3ov0o2gia071.jpg' },
    { id: 'default-background-8', name: 'Background 08', src: 'image/background/F9sR2BsaUAASne2.jpg' },
    { id: 'default-background-9', name: 'Background 09', src: 'image/background/372697890_7192981747398399_2954241215036537593_n.jpg' },
    { id: 'default-background-10', name: 'Background 10', src: 'image/background/GaBTB4PbUAAEGV0.jfif' }
];
const backgroundSelectionKey = 'selectedBackground';
let currentBackgroundUrl = null;

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

window.addEventListener('load', function() {
    setupVisualScorer();
});

window.addEventListener('load', function() {
    initBackgroundManager();
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
		let percent;
		const itemsPerSection = 10;

		if (isGradual) {
			const currentSectionIndex = Math.floor(index / itemsPerSection);

			const totalSections = Math.ceil(totalItems / itemsPerSection);

			if (totalSections === 0) {
				percent = 0;
			} else if (totalSections === 1) {
				percent = 0.5;
			} else {
				percent = currentSectionIndex / (totalSections - 1);
			}
		} else {			
			percent = totalItems === 1 ? 0.5 : index / (totalItems - 1);
		}

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
    const gamesTab = document.getElementById('gamesTab');
    const visualTab = document.getElementById('visualTab');
    const backgroundTab = document.getElementById('backgroundTab');
    const rankerMode = document.getElementById('rankerMode');
    const tierMode = document.getElementById('tierMode');
    const gamesMode = document.getElementById('gamesMode');
    const visualMode = document.getElementById('visualMode');
    const backgroundMode = document.getElementById('backgroundMode');

    rankerTab.classList.remove('active');
    tierTab.classList.remove('active');
    gamesTab.classList.remove('active');
    visualTab.classList.remove('active');
    if (backgroundTab) {
        backgroundTab.classList.remove('active');
    }
    rankerMode.classList.add('hidden');
    tierMode.classList.add('hidden');
    gamesMode.classList.add('hidden');
    visualMode.classList.add('hidden');
    if (backgroundMode) {
        backgroundMode.classList.add('hidden');
    }

    if (mode === 'ranker') {
        rankerTab.classList.add('active');
        rankerMode.classList.remove('hidden');
    } else if (mode === 'tier') {
        tierTab.classList.add('active');
        tierMode.classList.remove('hidden');
    } else if (mode === 'games') {
        gamesTab.classList.add('active');
        gamesMode.classList.remove('hidden');
    } else if (mode === 'visual') {
        visualTab.classList.add('active');
        visualMode.classList.remove('hidden');
        resetVisualScorer();
    } else if (mode === 'background' && backgroundTab && backgroundMode) {
        backgroundTab.classList.add('active');
        backgroundMode.classList.remove('hidden');
    }
}

function setupVisualScorer() {
    const slider = document.getElementById('visualScoreSlider');
    const toggle = document.getElementById('visualScoreToggle');
    if (!slider || !toggle) {
        return;
    }

    slider.addEventListener('input', () => {
        updateVisualScoreValue();
    });
    slider.addEventListener('dragstart', (event) => {
        event.preventDefault();
    });

    toggle.addEventListener('click', () => {
        toggleVisualScore();
    });

    resetVisualScorer();
}

function formatVisualScore(value) {
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) {
        return value;
    }
    return Number.isInteger(numericValue) ? numericValue.toString() : numericValue.toFixed(1);
}

function updateVisualScoreValue() {
    const slider = document.getElementById('visualScoreSlider');
    const value = document.getElementById('visualScoreValue');
    if (!slider || !value) {
        return;
    }
    value.textContent = formatVisualScore(slider.value);
}

function resetVisualScorer() {
    const sliderWrapper = document.getElementById('visualSliderWrapper');
    const display = document.getElementById('visualScoreDisplay');
    const toggle = document.getElementById('visualScoreToggle');
    const slider = document.getElementById('visualScoreSlider');

    if (slider) {
        slider.value = visualScoreDefault;
    }
    updateVisualScoreValue();
    if (sliderWrapper) {
        sliderWrapper.classList.remove('hidden');
    }
    if (display) {
        display.classList.add('hidden');
    }
    if (toggle) {
        toggle.textContent = 'Show score';
    }
}

function initBackgroundManager() {
    const defaultGrid = document.getElementById('defaultBackgroundGrid');
    const customGrid = document.getElementById('customBackgroundGrid');
    const uploadButton = document.getElementById('backgroundUploadButton');
    const uploadInput = document.getElementById('backgroundUploadInput');
    const clearButton = document.getElementById('backgroundClearButton');

    if (!defaultGrid || !customGrid || !uploadButton || !uploadInput || !clearButton) {
        return;
    }

    renderDefaultBackgrounds(defaultGrid);
    loadCustomBackgrounds(customGrid).then(() => {
        applySavedBackgroundSelection();
    });

    uploadButton.addEventListener('click', () => {
        uploadInput.click();
    });

    uploadInput.addEventListener('change', async (event) => {
        const file = event.target.files && event.target.files[0];
        if (!file) {
            return;
        }
        try {
            await saveCustomBackground(file);
            await refreshCustomBackgrounds(customGrid);
        } catch (error) {
            console.error('Failed to save background', error);
        } finally {
            uploadInput.value = '';
        }
    });

    clearButton.addEventListener('click', async () => {
        await clearCustomBackgrounds();
        await refreshCustomBackgrounds(customGrid);
        const fallback = defaultBackgrounds[0];
        if (fallback) {
            setBackgroundSelection({ type: 'default', src: fallback.src });
        }
    });
}

function renderDefaultBackgrounds(grid) {
    grid.innerHTML = '';
    defaultBackgrounds.forEach((background) => {
        const tile = createBackgroundTile({
            id: background.id,
            label: background.name,
            src: background.src,
            type: 'default'
        });
        grid.appendChild(tile);
    });
}

function createBackgroundTile({ id, label, src, type }) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'background-tile';
    tile.dataset.type = type;
    tile.dataset.id = id;
    tile.dataset.src = src;

    const image = document.createElement('img');
    image.src = src;
    image.alt = label;

    tile.appendChild(image);

    tile.addEventListener('click', () => {
        if (type === 'default') {
            setBackgroundSelection({ type: 'default', src });
        } else if (type === 'custom') {
            const customId = Number(id);
            setBackgroundSelection({ type: 'custom', id: customId });
        }
    });

    return tile;
}

async function loadCustomBackgrounds(grid) {
    const items = await getAllCustomBackgrounds();
    grid.innerHTML = '';
    if (items.length === 0) {
        grid.innerHTML = '<p class="background-description">No uploads yet.</p>';
        return;
    }
    items.forEach((item) => {
        const imageUrl = URL.createObjectURL(item.blob);
        const tile = createBackgroundTile({
            id: item.id,
            label: item.name || `Upload ${item.id}`,
            src: imageUrl,
            type: 'custom'
        });
        tile.dataset.objectUrl = imageUrl;
        grid.appendChild(tile);
    });
}

async function refreshCustomBackgrounds(grid) {
    revokeCustomObjectUrls(grid);
    await loadCustomBackgrounds(grid);
    applySavedBackgroundSelection();
}

function revokeCustomObjectUrls(grid) {
    const tiles = grid.querySelectorAll('.background-tile');
    tiles.forEach((tile) => {
        const objectUrl = tile.dataset.objectUrl;
        if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
        }
    });
}

function setBackgroundSelection(selection) {
    localStorage.setItem(backgroundSelectionKey, JSON.stringify(selection));
    applyBackgroundSelection(selection);
    updateBackgroundSelectionHighlight(selection);
}

function applySavedBackgroundSelection() {
    const stored = localStorage.getItem(backgroundSelectionKey);
    if (!stored) {
        const fallback = defaultBackgrounds[0];
        if (fallback) {
            setBackgroundSelection({ type: 'default', src: fallback.src });
        }
        return;
    }
    try {
        const parsed = JSON.parse(stored);
        applyBackgroundSelection(parsed);
        updateBackgroundSelectionHighlight(parsed);
    } catch (error) {
        console.error('Failed to read saved background selection', error);
    }
}

function applyBackgroundSelection(selection) {
    if (!selection) {
        return;
    }
    if (selection.type === 'default' && selection.src) {
        setBodyBackground(selection.src);
    } else if (selection.type === 'custom' && selection.id != null) {
        loadCustomBackgroundById(selection.id).then((blob) => {
            if (blob) {
                const objectUrl = URL.createObjectURL(blob);
                setBodyBackground(objectUrl, true);
            }
        });
    }
}

function updateBackgroundSelectionHighlight(selection) {
    const tiles = document.querySelectorAll('.background-tile');
    tiles.forEach((tile) => {
        tile.classList.remove('selected');
    });

    if (!selection) {
        return;
    }

    if (selection.type === 'default') {
        const matchingTile = document.querySelector(`.background-tile[data-type=\"default\"][data-src=\"${CSS.escape(selection.src)}\"]`);
        if (matchingTile) {
            matchingTile.classList.add('selected');
        }
    } else if (selection.type === 'custom') {
        const matchingTile = document.querySelector(`.background-tile[data-type=\"custom\"][data-id=\"${selection.id}\"]`);
        if (matchingTile) {
            matchingTile.classList.add('selected');
        }
    }
}

function setBodyBackground(sourceUrl, isObjectUrl = false) {
    if (currentBackgroundUrl && currentBackgroundUrl.isObjectUrl) {
        URL.revokeObjectURL(currentBackgroundUrl.url);
    }
    document.body.style.backgroundImage = `url('${sourceUrl}')`;
    currentBackgroundUrl = { url: sourceUrl, isObjectUrl };
}

function openBackgroundDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('backgroundStore', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('customBackgrounds')) {
                db.createObjectStore('customBackgrounds', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

async function saveCustomBackground(file) {
    const db = await openBackgroundDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('customBackgrounds', 'readwrite');
        const store = transaction.objectStore('customBackgrounds');
        const request = store.add({ name: file.name, blob: file });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getAllCustomBackgrounds() {
    const db = await openBackgroundDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('customBackgrounds', 'readonly');
        const store = transaction.objectStore('customBackgrounds');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

async function loadCustomBackgroundById(id) {
    const db = await openBackgroundDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('customBackgrounds', 'readonly');
        const store = transaction.objectStore('customBackgrounds');
        const request = store.get(Number(id));
        request.onsuccess = () => resolve(request.result ? request.result.blob : null);
        request.onerror = () => reject(request.error);
    });
}

async function clearCustomBackgrounds() {
    const db = await openBackgroundDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('customBackgrounds', 'readwrite');
        const store = transaction.objectStore('customBackgrounds');
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function toggleVisualScore() {
    const sliderWrapper = document.getElementById('visualSliderWrapper');
    const display = document.getElementById('visualScoreDisplay');
    const toggle = document.getElementById('visualScoreToggle');

    if (!sliderWrapper || !display || !toggle) {
        return;
    }

    if (display.classList.contains('hidden')) {
        updateVisualScoreValue();
        sliderWrapper.classList.add('hidden');
        display.classList.remove('hidden');
        toggle.textContent = 'Back';
    } else {
        resetVisualScorer();
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
const tierLabelOrder = ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
const minTierCount = 1;
const maxTierCount = 10;
const defaultTierCount = 5;
const tierGradientStart = '#c53030';
const tierGradientMiddle = '#ecc94b';
const tierGradientEnd = '#38a169';
let tierNames = [];

function getTierCountDisplay() {
    return document.getElementById('tierCountDisplay');
}

function generateTierNames(count) {
    return tierLabelOrder.slice(0, count);
}

function getTierColorByIndex(index, total) {
    if (total <= 1) {
        return generateGradientColor(tierGradientStart, tierGradientEnd, 0.5);
    }
    const percent = index / (total - 1);
    if (percent <= 0.5) {
        return generateGradientColor(tierGradientStart, tierGradientMiddle, percent * 2);
    }
    return generateGradientColor(tierGradientMiddle, tierGradientEnd, (percent - 0.5) * 2);
}

function updateTierCountDisplay(count) {
    const display = getTierCountDisplay();
    if (display) {
        display.textContent = count;
    }
}

function updateTierCountControls(count) {
    const increaseButton = document.getElementById('increaseTierCount');
    const decreaseButton = document.getElementById('decreaseTierCount');
    if (increaseButton) {
        increaseButton.disabled = count >= maxTierCount;
    }
    if (decreaseButton) {
        decreaseButton.disabled = count <= minTierCount;
    }
}

function createTierRow(tier, index) {
    const row = document.createElement('div');
    row.className = 'tier-row';

    const label = document.createElement('div');
    label.className = 'tier-label';
    label.textContent = tier;
    label.style.backgroundColor = getTierColorByIndex(index, tierNames.length);

    const content = document.createElement('div');
    content.className = 'tier-content';
    content.setAttribute('data-tier', tier);

    row.appendChild(label);
    row.appendChild(content);

    return row;
}

function createPoolItem(text) {
    const item = document.createElement('div');
    item.className = 'pool-item';
    item.draggable = true;
    item.textContent = text.trim();
    addTierDragListeners(item);
    return item;
}

function createTierItem(text, tier) {
    const item = document.createElement('div');
    item.className = 'tier-item';
    item.draggable = true;
    item.textContent = text.trim();
    applyTierColor(item, tier);
    addTierDragListeners(item);
    return item;
}

function setTierCount(newCount, { preserveItems = true, save = true } = {}) {
    const count = Math.min(maxTierCount, Math.max(minTierCount, newCount));
    const tierListArea = document.getElementById('tierListArea');
    const itemPool = document.getElementById('itemPool');

    const existingPoolItems = [];
    const existingTierItems = {};

    if (preserveItems) {
        if (itemPool) {
            itemPool.querySelectorAll('.pool-item').forEach(item => {
                existingPoolItems.push(item.textContent.trim());
            });
        }

        document.querySelectorAll('.tier-content').forEach(content => {
            const tier = content.getAttribute('data-tier');
            existingTierItems[tier] = Array.from(content.querySelectorAll('.tier-item')).map(
                item => item.textContent.trim()
            );
        });
    }

    tierNames = generateTierNames(count);

    if (tierListArea) {
        tierListArea.innerHTML = '';
        tierNames.forEach((tier, index) => {
            tierListArea.appendChild(createTierRow(tier, index));
        });
    }

    if (itemPool) {
        itemPool.innerHTML = '';
    }

    const removedTierItems = Object.keys(existingTierItems)
        .filter(tier => !tierNames.includes(tier))
        .flatMap(tier => existingTierItems[tier]);

    const poolItems = [...existingPoolItems, ...removedTierItems];
    poolItems.forEach(text => {
        itemPool.appendChild(createPoolItem(text));
    });

    tierNames.forEach(tier => {
        const tierContent = document.querySelector(`[data-tier="${tier}"]`);
        const items = existingTierItems[tier] || [];
        items.forEach(text => {
            tierContent.appendChild(createTierItem(text, tier));
        });
    });

    updateTierCountDisplay(count);
    updateTierCountControls(count);
    setupTierDropZones();

    if (save) {
        saveTierDataToCache();
        isTierListModified = true;
    }
}

function increaseTierCount() {
    setTierCount(tierNames.length + 1);
}

function decreaseTierCount() {
    setTierCount(tierNames.length - 1);
}

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
    
	if (isTierListModified && !confirm("You have unsaved changes. Do you really want to reset the list?")) {
        return;
    }
	
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
        itemPool.appendChild(createPoolItem(song));
    });
    
    // Setup drop zones
    setupTierDropZones();
    
    // Save to cache
    saveTierDataToCache();
}

// Save tier data to localStorage
function saveTierDataToCache() {
    const tierData = {
        tierCount: tierNames.length,
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
    if (!savedTierData) {
        setTierCount(defaultTierCount, { preserveItems: false, save: false });
        return;
    }
    
    try {
        const tierData = JSON.parse(savedTierData);
        const itemPool = document.getElementById('itemPool');

        const savedTierCount = Number(tierData.tierCount) || defaultTierCount;
        setTierCount(savedTierCount, { preserveItems: false, save: false });
        
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
                itemPool.appendChild(createPoolItem(songText));
            });
        }
        
        // Restore tier items
        if (tierData.tiers) {
            tierNames.forEach(tier => {
                if (tierData.tiers[tier]) {
                    const tierContent = document.querySelector(`[data-tier="${tier}"]`);
                    tierData.tiers[tier].forEach(songText => {
                        tierContent.appendChild(createTierItem(songText, tier));
						
						isTierListModified = true;
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
            const dropTarget = getDropTargetItem(this, e);

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
            
            if (dropTarget) {
                const targetRect = dropTarget.getBoundingClientRect();
                const insertAfter = e.clientX > targetRect.left + targetRect.width / 2;
                dropTarget.insertAdjacentElement(insertAfter ? 'afterend' : 'beforebegin', draggedItem);
            } else {
                this.appendChild(draggedItem);
            }
            
            // Save to cache after any change
            saveTierDataToCache();
			
			isTierListModified = true;
        }
    });
}

function getDropTargetItem(container, event) {
    const hoveredElement = document.elementFromPoint(event.clientX, event.clientY);
    if (!hoveredElement) {
        return null;
    }
    const targetItem = hoveredElement.closest('.tier-item, .pool-item');
    if (!targetItem || targetItem === draggedItem) {
        return null;
    }
    if (targetItem.parentElement !== container) {
        return null;
    }
    return targetItem;
}

// Function to apply tier-specific colors to items
function applyTierColor(item, tier) {
    const tierIndex = tierNames.indexOf(tier);
    const color = tierIndex >= 0
        ? getTierColorByIndex(tierIndex, tierNames.length)
        : '#4a5568';
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



//==========
//GAMES SECTION
//==========
function loadRankedSongs() {
    const savedItems = localStorage.getItem('rowSorterItems');
    const statusEl = document.getElementById('importStatus');

    if (!savedItems) {
        statusEl.textContent = "No ranked songs found! Please rank songs first.";
        statusEl.style.color = "red";
        return;
    }
    statusEl.textContent = "Ranked songs imported successfully!";
    statusEl.style.color = "green";
}

function seededRandom(seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
        h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
    }
    return function() {
        h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
        return ((h < 0 ? ~h + 1 : h) % 1000) / 1000;
    };
}

function generateTopBottom10Game() {
    const savedItems = localStorage.getItem('rowSorterItems');
    if (!savedItems) {
        document.getElementById('importStatus').textContent = "No ranked songs found!";
        document.getElementById('importStatus').style.color = "red";
        return;
    }

    const songs = savedItems.split('\n').filter(Boolean);
    if (songs.length < 20) {
        document.getElementById('importStatus').textContent = "Need at least 20 ranked songs!";
        document.getElementById('importStatus').style.color = "red";
        return;
    }

    const isHiddenTop1 = document.getElementById('hiddenTop1Toggle').checked;
    const isHiddenBottom1 = document.getElementById('hiddenBottom1Toggle').checked;
    const isFixedRandom = document.getElementById('fixedRandomToggle').checked;

    const top10 = songs.slice(0, 10);
    const bottom10 = songs.slice(-10);

    // Pick random generator
    const seed = songs.join('');
    const rand = isFixedRandom ? seededRandom(seed) : Math.random;

    // Pick N unique indexes to hide
    function pickHidden(count, max, forceIndexes = []) {
        let set = new Set(forceIndexes);
        while (set.size < count) {
            set.add(Math.floor(rand() * max));
        }
        return set;
    }

    // Ensure first/top1 is hidden if toggle is active
    const topHidden = pickHidden(5, 10, isHiddenTop1 ? [0] : []);

    // Ensure last/bottom1 is hidden if toggle is active
    const bottomHidden = pickHidden(5, 10, isHiddenBottom1 ? [bottom10.length - 1] : []);

    // Build top 10 list
    const topListEl = document.getElementById('top10GameList');
    topListEl.innerHTML = '';
    top10.forEach((song, i) => {
        const item = document.createElement('div');
        if (topHidden.has(i)) {
            item.className = 'song-item song-item-hidden';
            item.textContent = `???`;
        } else {
            item.className = 'song-item song-item-revealed';
            item.textContent = `${i + 1}. ${song}`;
        }
        topListEl.appendChild(item);
    });

    // Build bottom 10 list
    const bottomListEl = document.getElementById('bottom10GameList');
    bottomListEl.innerHTML = '';
    bottom10.forEach((song, i) => {
        const rank = songs.length - 10 + i + 1;
        const item = document.createElement('div');
        if (bottomHidden.has(i)) {
            item.className = 'song-item song-item-hidden';
            item.textContent = `???`;
        } else {
            item.className = 'song-item song-item-revealed';
            item.textContent = `${rank}. ${song}`;
        }
        bottomListEl.appendChild(item);
    });

    // Show results container
    document.getElementById('topBottomGameResult').classList.remove('hidden');
}


function generateChaoticTopBottomGame() {
    const savedItems = localStorage.getItem('rowSorterItems');
    if (!savedItems) {
        document.getElementById('importStatus').textContent = "No ranked songs found!";
        document.getElementById('importStatus').style.color = "red";
        return;
    }

    const songs = savedItems.split('\n').filter(Boolean);
    if (songs.length < 20) {
        document.getElementById('importStatus').textContent = "Need at least 20 ranked songs!";
        document.getElementById('importStatus').style.color = "red";
        return;
    }

    const isHiddenTop1 = document.getElementById('hiddenTop1Toggle').checked;
    const isHiddenBottom1 = document.getElementById('hiddenBottom1Toggle').checked;
    const isFixedRandom = document.getElementById('fixedRandomToggle').checked;

    const top10 = songs.slice(0, 10);
    const bottom10 = songs.slice(-10);

    // Remaining pool to pick decoys from (excluding top & bottom 10)
    const middleSongs = songs.slice(10, -10);

    // Choose random function: seeded or pure random
    const seed = songs.join('chaos');
    const rand = isFixedRandom ? seededRandom(seed) : Math.random;

    function mixWithDecoys(list, listName) {
        const mixed = [...list];
        const decoyCount = Math.min(5, middleSongs.length);

        const usedIndexes = new Set();

        // Force replace top1 if enabled
        if (listName === "Top" && isHiddenTop1 && middleSongs.length > 0) {
            const decoy = middleSongs[Math.floor(rand() * middleSongs.length)];
            mixed[0] = decoy;
            usedIndexes.add(0);
        }

        // Force replace bottom1 if enabled
        if (listName === "Bottom" && isHiddenBottom1 && middleSongs.length > 0) {
            const lastIndex = mixed.length - 1;
            const decoy = middleSongs[Math.floor(rand() * middleSongs.length)];
            mixed[lastIndex] = decoy;
            usedIndexes.add(lastIndex);
        }

        while (usedIndexes.size < decoyCount) {
            const replaceIndex = Math.floor(rand() * mixed.length);
            if (usedIndexes.has(replaceIndex)) continue;
            usedIndexes.add(replaceIndex);

            const decoy = middleSongs[Math.floor(rand() * middleSongs.length)];
            mixed[replaceIndex] = decoy;
        }

        return mixed;
    }

    const chaoticTop = mixWithDecoys(top10, "Top");
    const chaoticBottom = mixWithDecoys(bottom10, "Bottom");

    // Render top chaotic list
    const topListEl = document.getElementById('chaoticTopList');
    topListEl.innerHTML = '';
    chaoticTop.forEach((song, i) => {
        const item = document.createElement('div');
        item.className = 'song-item song-item-revealed';
        item.textContent = `${i + 1}. ${song}`;
        topListEl.appendChild(item);
    });

    // Render bottom chaotic list
    const bottomListEl = document.getElementById('chaoticBottomList');
    bottomListEl.innerHTML = '';
    chaoticBottom.forEach((song, i) => {
        const rank = songs.length - 10 + i + 1;
        const item = document.createElement('div');
        item.className = 'song-item song-item-revealed-type2';
        item.textContent = `${rank}. ${song}`;
        bottomListEl.appendChild(item);
    });

    document.getElementById('chaoticGameResult').classList.remove('hidden');
}


function updateGamePanelBgColor() {
    const hexColor = document.getElementById('gameBgColorPicker').value;
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    const rgba = `rgba(${r}, ${g}, ${b}, 0.8)`;
    
    document.querySelectorAll('.game-section').forEach(section => {
        section.style.backgroundColor = rgba;
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
    document.getElementById('gameBgColorPicker').addEventListener('input', updateGamePanelBgColor);
    
    // Share button (if it exists)
    const shareButton = document.getElementById('shareButton');
    if (shareButton) {
        shareButton.addEventListener('click', shareRanking);
    }

    const increaseTierButton = document.getElementById('increaseTierCount');
    if (increaseTierButton) {
        increaseTierButton.addEventListener('click', increaseTierCount);
    }

    const decreaseTierButton = document.getElementById('decreaseTierCount');
    if (decreaseTierButton) {
        decreaseTierButton.addEventListener('click', decreaseTierCount);
    }
});
