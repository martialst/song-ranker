let draggedItem = null;
let draggingOverItem = null;
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
    
    const wordList = document.getElementById('wordList');
    wordList.innerHTML = '';  // Clear current list

    rowsArray.forEach((row, index) => {
        const rowElement = document.createElement('div');
        rowElement.classList.add('word-item');
        rowElement.setAttribute('draggable', true);

        const numberElement = document.createElement('span');
        numberElement.classList.add('word-item-number');
        numberElement.textContent = `${index + 1}.`;

        const textElement = document.createElement('span');
        textElement.textContent = row;

        rowElement.appendChild(numberElement);
        rowElement.appendChild(textElement);

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
            
            // Dynamically move the item up or down based on mouse position
            if (e.clientY - offset > 0) {
                draggingOverItem.style['border-bottom'] = "2px solid #4299e1";
                draggingOverItem.style['border-top'] = "";
            } else {
                draggingOverItem.style['border-top'] = "2px solid #4299e1";
                draggingOverItem.style['border-bottom'] = "";
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
            draggingOverItem.style['border-bottom'] = "";
            draggingOverItem.style['border-top'] = "";
        });

        rowElement.addEventListener('drop', function(e) {
            e.preventDefault();
            draggingOverItem.style['border-bottom'] = "";
            draggingOverItem.style['border-top'] = "";

            if (draggedItem !== this) {
                const bounding = draggingOverItem.getBoundingClientRect();
                const offset = bounding.y + bounding.height / 2;

                // Insert the dragged item before or after the target, depending on mouse position
                if (e.clientY - offset > 0) {
                    draggingOverItem.insertAdjacentElement('afterend', draggedItem);
                } else {
                    draggingOverItem.insertAdjacentElement('beforebegin', draggedItem);
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
    const orderedRows = Array.from(wordElements).map(item => item.querySelector('span:last-child').textContent);
    document.getElementById('outputWords').value = orderedRows.join('\n');
}

// Save items to browser's local storage
function saveItemsToCache() {
    const wordElements = document.querySelectorAll('.word-item');
    const items = Array.from(wordElements).map(item => item.querySelector('span:last-child').textContent);
    localStorage.setItem('rowSorterItems', items.join('\n'));
}
