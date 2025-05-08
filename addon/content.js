function getBoardInfo() {
    // Find active board - Correct selector with double dash
    const current = document.querySelector('.relay-game--current');
    let boardNumber = null;
    if (current && current.getAttribute('data-n')) {
        boardNumber = parseInt(current.getAttribute('data-n'), 10);
        console.log("Content: Found active board with number (0-based)", boardNumber);
    } else {
        console.log("Content: No active board found with .relay-game--current", 
            document.querySelectorAll('.relay-game').length > 0 ? 
            "Found " + document.querySelectorAll('.relay-game').length + " relay-game elements" : 
            "No relay-game elements found");
    }

    // Get broadcast round URL
    let broadcastUrl = null;
    const currentUrl = window.location.href;
    if (currentUrl.includes('/broadcast/')) {
        // Split by '/' and remove the last part (game ID)
        const urlParts = currentUrl.split('/');
        urlParts.pop(); // Remove the last part
        broadcastUrl = urlParts.join('/');
        console.log("Content: Found broadcast URL:", broadcastUrl);
    }

    // Count total boards in the broadcast
    let totalBoards = 0;
    const gamesContainer = document.querySelector('.relay-games.relay-games__eval');
    if (gamesContainer) {
        totalBoards = gamesContainer.querySelectorAll('.relay-game').length;
        console.log("Content: Found total boards:", totalBoards);
    } else {
        console.log("Content: Could not find games container");
    }

    // Improved turn color detection based on the clock elements
    let turn = null;
    
    // The classes in the element are: class="analyse_clock top active"
    const topClockActive = document.querySelector('.analyse__clock.top.active');
    const bottomClockActive = document.querySelector('.analyse__clock.bottom.active');
    
    console.log("Content: Checking clock status", 
                "black clock:", topClockActive !== null, 
                "white clock:", bottomClockActive !== null);
    
    if (topClockActive) {
        // Black's turn, if the top clock is active
        turn = 'black';
        console.log("Content: Turn is black (clock method)");
    } else if (bottomClockActive) {
        // White's turn, if the bottom clock is active
        turn = 'white';
        console.log("Content: Turn is white (clock method)");
    }
    
    // Fallback to the old method if the clock method doesn't find anything
    if (!turn) {
        const board = document.querySelector('.analyse_board');
        if (board) {
            if (board.classList.contains('turn-white')) {
                turn = 'white';
                console.log("Content: Turn is white (fallback method)");
            }
            if (board.classList.contains('turn-black')) {
                turn = 'black';
                console.log("Content: Turn is black (fallback method)");
            }
        }
    }

    const result = { boardNumber, turn, totalBoards, broadcastUrl };
    console.log("Content: Returning board info", result);
    return result;
}

function sendUpdate() {
    const info = getBoardInfo();
    console.log("Content: Sending update to background", info);
    chrome.runtime.sendMessage({ type: "UPDATE_BOARD_INFO", ...info });
}

// Safe version of the update function, catching errors
function sendUpdateSafe() {
    try {
        sendUpdate();
    } catch (e) {
        console.error("Content: Error in sendUpdate", e);
        // Context is invalidated, ignore the error
    }
}

// Initial send
console.log("Content: Script initialized");
try {
    sendUpdate();
} catch (e) {
    console.error("Content: Error in initial sendUpdate", e);
    // Ignore errors during initial sendUpdate
}

// Finde das Schachbrett-Element mit dem teilweise dynamischen Klassennamen
function findBoardElement() {
    // Suche nach einem Element, dessen Klasse mit 'analyse__board main-board' beginnt
    const elements = document.querySelectorAll('[class^="analyse__board main-board"]');
    if (elements.length > 0) {
        return elements[0]; // Erstes passendes Element zurückgeben
    }
    
    // Alternative Suche, falls die obige Methode nicht funktioniert
    const alternatives = document.querySelectorAll('.analyse__board');
    for (const el of alternatives) {
        if (el.classList.contains('main-board')) {
            return el;
        }
    }
    
    return null;
}

// MutationObserver with error handling, observing only the board (ignores list of other boards to not consider their clocks)
const observer = new MutationObserver(sendUpdateSafe);
const boardElement = findBoardElement();

/*
if (boardElement) {
    console.log("Content: Found board element, setting up observer");
    observer.observe(boardElement, { 
        childList: true, 
        subtree: true,
        attributes: true,
        attributeFilter: ['class'] // Pay attention to class changes (for turn color)
    });
    console.log("Content: MutationObserver started on board element");
} else {
    console.log("Content: Could not find board element, observing body instead");
    observer.observe(document.body, { childList: true, subtree: true });
    console.log("Content: MutationObserver started on document.body");
}
*/

// Send additional regular updates (every .5 seconds)
setInterval(sendUpdateSafe, 500);
console.log("Content: Update interval started");

// Separate Observer during page unload 
window.addEventListener('unload', () => observer.disconnect());
console.log("Content: Unload listener added");