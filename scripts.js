let draggedItem = null;
let draggingOverItem = null;
let isListModified = false; // Track if the list has been modified
let scrollInterval = null; // To handle scrolling

// Load saved items from cache when the page loads
window.addEventListener('load', function() {
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

    // Check if the list has been modified before proceeding
    if (isListModified && !confirm("You have unsaved changes. Do you really want to reset the list?")) {
        return; // Cancel the import if the user doesn't confirm
    }

    const wordList = document.getElementById('wordList');
    wordList.innerHTML = '';  // Clear current list

	rowsArray.forEach((row, index) => {
		const rowElement = document.createElement('div');
		rowElement.classList.add('word-item');
		rowElement.setAttribute('draggable', true);

		// Create a wrapper for the text elements
		const textWrapper = document.createElement('div');
		textWrapper.classList.add('text-wrapper');

		const numberElement = document.createElement('span');
		numberElement.classList.add('word-item-number');
		numberElement.textContent = `${index + 1}.`;

		const textElement = document.createElement('span');
		textElement.textContent = row;

		// Create buttons for moving items
		const moveToTopButton = document.createElement('button');
		moveToTopButton.textContent = '▲'; // Arrow up
		moveToTopButton.classList.add('move-button');
		moveToTopButton.addEventListener('click', () => moveToTop(rowElement));

		const moveToBottomButton = document.createElement('button');
		moveToBottomButton.textContent = '▼'; // Arrow down
		moveToBottomButton.classList.add('move-button');
		moveToBottomButton.addEventListener('click', () => moveToBottom(rowElement));

		// Append elements to the textWrapper
		textWrapper.appendChild(numberElement);
		textWrapper.appendChild(textElement);
		
		// Append textWrapper and buttons to rowElement
		rowElement.appendChild(textWrapper);
		rowElement.appendChild(moveToTopButton);
		rowElement.appendChild(moveToBottomButton);

        // Event listeners for dynamic drag-and-drop
        rowElement.addEventListener('dragstart', function() {
            draggedItem = rowElement;
            setTimeout(() => rowElement.classList.add('draggable'), 0);
        });

        rowElement.addEventListener('dragend', function() {
            setTimeout(() => rowElement.classList.remove('draggable'), 0);
            draggedItem = null;
            clearInterval(scrollInterval); // Stop scrolling
            updateItemNumbers();
            saveItemsToCache(); // Save items after reordering
        });

        rowElement.addEventListener('dragover', function(e) {
            e.preventDefault();
            draggingOverItem = rowElement;
            const bounding = draggingOverItem.getBoundingClientRect();
            const offset = bounding.y + bounding.height / 2;
            
            // Determine where to apply the gradient effect
            if (e.clientY < offset) {
                draggingOverItem.style['background-image'] = 'linear-gradient(to bottom, rgba(66, 153, 225, 0.2), transparent)';
            } else {
                draggingOverItem.style['background-image'] = 'linear-gradient(to top, rgba(66, 153, 225, 0.2), transparent)';
            }

            // Auto-scroll if dragging near top or bottom of the list
            const scrollThreshold = 50; // Distance from top/bottom to start scrolling
            const wordListBounding = wordList.getBoundingClientRect();

            if (e.clientY < wordListBounding.top + scrollThreshold) {
                // Scroll up
                wordList.scrollBy(0, -10); // Adjust the scroll speed as needed
                startScroll(); // Start scrolling
            } else if (e.clientY > wordListBounding.bottom - scrollThreshold) {
                // Scroll down
                wordList.scrollBy(0, 10); // Adjust the scroll speed as needed
                startScroll(); // Start scrolling
            } else {
                clearInterval(scrollInterval); // Stop scrolling if not near edges
            }
        });

        rowElement.addEventListener('dragleave', function() {
            draggingOverItem.style['background-image'] = ''; // Reset background image
            draggingOverItem.style['border-bottom'] = "";
            draggingOverItem.style['border-top'] = "";
        });

        rowElement.addEventListener('drop', function(e) {
            e.preventDefault();
            draggingOverItem.style['background-image'] = ''; // Reset background image
            draggingOverItem.style['border-bottom'] = "";
            draggingOverItem.style['border-top'] = "";

            if (draggedItem !== this) {
                const bounding = draggingOverItem.getBoundingClientRect();
                const offset = bounding.y + bounding.height / 2;

                // Insert the dragged item before or after the target, depending on mouse position
                if (e.clientY < offset) {
                    draggingOverItem.insertAdjacentElement('beforebegin', draggedItem);
                } else {
                    draggingOverItem.insertAdjacentElement('afterend', draggedItem);
                }

                // Remove the recently-placed class from all items
                document.querySelectorAll('.word-item').forEach(item => {
                    item.classList.remove('recently-placed');
                });

                // Add the recently-placed class to the dropped item
                draggedItem.classList.add('recently-placed');

                // Remove the class after the animation completes
                setTimeout(() => {
                    draggedItem.classList.remove('recently-placed');
                }, 2000);
                
                isListModified = true; // Set the modified flag when dragging occurs
            }
        });

        wordList.appendChild(rowElement);
    });

    saveItemsToCache(); // Save items after importing
}

// Start scrolling function
function startScroll() {
    if (!scrollInterval) {
        scrollInterval = setInterval(() => {
            const bounding = draggingOverItem.getBoundingClientRect();
            if (bounding.top < 0) {
                wordList.scrollBy(0, -10); // Scroll up
            } else if (bounding.bottom > window.innerHeight) {
                wordList.scrollBy(0, 10); // Scroll down
            }
        }, 100); // Adjust the interval timing as needed
    }
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
    const wordElements = document.querySelectorAll('.word-item');
    const orderedRows = Array.from(wordElements).map(item => item.querySelector('span:nth-child(2)').textContent); // Use nth-child(2) to get the second span
    document.getElementById('outputWords').value = orderedRows.join('\n');
}

// Save items to browser's local storage
function saveItemsToCache() {
    const wordElements = document.querySelectorAll('.word-item');
    const items = Array.from(wordElements).map(item => item.querySelector('span:last-child').textContent);
    localStorage.setItem('rowSorterItems', items.join('\n'));
}

document.addEventListener('DOMContentLoaded', function() {
    const showResultsButton = document.getElementById('showResultsButton');
    const resultsGrid = document.getElementById('resultsGrid');
    
    if (showResultsButton && resultsGrid) {
        // Add event listener to the button
        showResultsButton.addEventListener('click', showResults);
    } else {
        console.error('Required elements not found: showResultsButton or resultsGrid');
    }
});

// Helper function to generate colors in a gradient
function generateGradientColor(startColor, endColor, percent) {
    const start = parseInt(startColor.slice(1), 16); // Remove "#" and convert to integer
    const end = parseInt(endColor.slice(1), 16);

    const r = Math.floor((start >> 16) * (1 - percent) + (end >> 16) * percent);
    const g = Math.floor(((start >> 8) & 0xff) * (1 - percent) + ((end >> 8) & 0xff) * percent);
    const b = Math.floor((start & 0xff) * (1 - percent) + (end & 0xff) * percent);

    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// Color picker functions for Text and Panel Background
function updateTextColor() {
    const color = document.getElementById('textColorPicker').value;
    document.querySelectorAll('.result-item').forEach(item => {
        item.style.color = color;
    });
}

function updatePanelBgColor() {
    const hexColor = document.getElementById('panelBgColorPicker').value;

    // Convert hex to RGB
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);

    // Set the background color with 0.8 transparency
    document.getElementById('resultsGrid').style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.8)`;
}

// Gradient Mode Toggle
function toggleGradientMode() {
    const isGradual = document.getElementById('gradientModeToggle').checked;
    showResults(isGradual); // Pass the gradient mode to the showResults function
}

// Update the event listeners on color pickers and toggle
document.getElementById('startColorPicker').addEventListener('input', toggleGradientMode);
document.getElementById('endColorPicker').addEventListener('input', toggleGradientMode);
document.getElementById('textColorPicker').addEventListener('input', updateTextColor);
document.getElementById('panelBgColorPicker').addEventListener('input', updatePanelBgColor);
document.getElementById('gradientModeToggle').addEventListener('change', toggleGradientMode);

function showResults(isGradual = false) {
    const resultsSection = document.getElementById('resultsSection');
    const resultsGrid = document.getElementById('resultsGrid');
    
    if (!resultsGrid) {
        console.error('Results grid element not found.');
        return;
    }

    const startColor = document.getElementById('startColorPicker').value;
    const endColor = document.getElementById('endColorPicker').value;
    resultsGrid.innerHTML = ''; // Clear previous results

    const wordElements = document.querySelectorAll('.word-item');
    const totalItems = wordElements.length;

    const orderedRows = Array.from(wordElements).map((item, index) => {
        let percent;
        if (isGradual) {
            // Apply the same color for each 10-item block
            percent = Math.floor(index / 10) / (totalItems / 10);
        } else {
            // Smooth gradient for each item
            percent = index / (totalItems - 1);
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



function moveToTop(item) {
    const wordList = document.getElementById('wordList');
    wordList.prepend(item); // Move the item to the top
    updateItemNumbers(); // Update the numbers after moving
    isListModified = true; // Mark the list as modified
}

function moveToBottom(item) {
    const wordList = document.getElementById('wordList');
    wordList.appendChild(item); // Move the item to the bottom
    updateItemNumbers(); // Update the numbers after moving
    isListModified = true; // Mark the list as modified
}





//SHORTENER
// Declare urlMapping at the top of the script
let urlMapping = {}; 

// Load URL mapping from local storage on page load
function loadUrlMapping() {
    const savedMapping = localStorage.getItem('urlMapping');
    if (savedMapping) {
        urlMapping = JSON.parse(savedMapping);
    }
}

// Save the updated URL mapping to local storage
function saveUrlMapping() {
    localStorage.setItem('urlMapping', JSON.stringify(urlMapping));
}

// Function to generate a unique short identifier
function generateShortId() {
    return 'id_' + Math.random().toString(36).substr(2, 8); // Generates a random 8-character ID
}

// Share Ranking Functionality with URL shortening
function shareRanking() {
    const wordElements = document.querySelectorAll('.word-item');
    const orderedRows = Array.from(wordElements).map(item => item.querySelector('span:last-child').textContent);
    
    // Encode the ordered list as a hash fragment
    const encodedRanking = encodeURIComponent(JSON.stringify(orderedRows));
    
    // Check if this ranking already has a short ID
    let shortId = null;
    for (const id in urlMapping) {
        if (urlMapping[id] === encodedRanking) {
            shortId = id;
            break;
        }
    }

    // If no existing short ID found, generate a new one
    if (!shortId) {
        shortId = generateShortId();
        urlMapping[shortId] = encodedRanking; // Map the short ID to the ranking
        saveUrlMapping(); // Save the updated mapping
    }
    
    const currentURL = window.location.href.split('#')[0]; // Get the current URL without any hash
    const shareableURL = `${currentURL}#${shortId}`; // Use the short ID in the URL
    
    // Copy to clipboard
    navigator.clipboard.writeText(shareableURL).then(() => {
        alert('Short Ranking URL copied to clipboard: ' + shareableURL);
    }).catch(err => {
        console.error('Could not copy text: ', err);
    });
}

window.addEventListener('load', function() {
    loadUrlMapping(); // Load the mapping when the page loads

    // Check for hash fragment
    const hash = window.location.hash;
    if (hash.startsWith('#id_')) { // Check if it starts with the short ID prefix
        const shortId = hash.substring(1); // Remove the '#' from the ID
        const encodedRanking = urlMapping[shortId]; // Get the ranking from the mapping

        if (encodedRanking) {
            const orderedRows = JSON.parse(decodeURIComponent(encodedRanking));
            // Populate the input area and import the words
            document.getElementById('inputWords').value = orderedRows.join('\n');
            importWords(); // Call the import function to display the songs
        } else {
            console.error('No ranking found for this ID');
        }
    } else {
        const savedItems = localStorage.getItem('rowSorterItems');
        if (savedItems) {
            document.getElementById('inputWords').value = savedItems;
            importWords();
        }
    }
});

// Attach event listener to the share button
document.getElementById('shareButton').addEventListener('click', shareRanking);

// Attach event to the import button
document.getElementById('importWords').addEventListener('click', importWords);