let lastInfo = { boardNumber: null, turn: null, totalBoards: null, broadcastUrl: null };
let target = null;

chrome.storage.local.get(['target'], (result) => {
    if (result.target) target = result.target;
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "UPDATE_BOARD_INFO") {
        lastInfo = { 
            boardNumber: msg.boardNumber, 
            turn: msg.turn, 
            totalBoards: msg.totalBoards,
            broadcastUrl: msg.broadcastUrl
        };
        chrome.storage.local.set({ lastInfo });
        if (target && msg.boardNumber && msg.turn) {
            fetch(`http://${target}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(lastInfo)
            }).catch(() => {});
        }
    } else if (msg.type === "SET_TARGET") {
        target = msg.target;
        chrome.storage.local.set({ target });
    } else if (msg.type === "GET_INFO") {
        sendResponse({ ...lastInfo, target });
        return true; // Important for asynchronous response
    }
});
