let draggedItem = null;
let draggingOverItem = null;
let isListModified = false; // Track if the list has been modified

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
        });

        rowElement.addEventListener('dragleave', function() {
            draggingOverItem.style['background-image'] = ''; // Reset background image
        });

        rowElement.addEventListener('drop', function(e) {
            e.preventDefault();
            draggingOverItem.style['background-image'] = ''; // Reset background image

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

// Attach event to the import button
document.getElementById('importWords').addEventListener('click', importWords);
