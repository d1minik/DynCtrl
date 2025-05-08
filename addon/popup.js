// Variables to follow the focus of the input fields
let ipAddressFieldHasFocus = false;
let portFieldHasFocus = false;

function update() {
    console.log("Popup: Sending GET_INFO message");
    chrome.runtime.sendMessage({ type: "GET_INFO" }, (info) => {
        console.log("Popup: Received response from background", info);
        
        if (!info) {
            console.error("Popup: No info received from background script");
            return;
        }
        
        // Display board number
        const boardNumberElement = document.getElementById('boardNumber');
        if (boardNumberElement) {
            const boardText = info.boardNumber || '-';
            const totalText = info.totalBoards ? `/${info.totalBoards}` : '';
            boardNumberElement.textContent = boardText + totalText;
        }
        
        // Display turn color
        const turnElement = document.getElementById('turn');
        if (turnElement) {
            turnElement.textContent = info.turn || '-';
            
            // Optional: Also display the color visually
            if (info.turn === 'white') {
                turnElement.style.color = 'white';
                turnElement.style.backgroundColor = '#666';
                turnElement.style.padding = '2px 8px';
                turnElement.style.borderRadius = '4px';
            } else if (info.turn === 'black') {
                turnElement.style.color = 'black';
                turnElement.style.backgroundColor = '#ddd';
                turnElement.style.padding = '2px 8px';
                turnElement.style.borderRadius = '4px';
            } else {
                turnElement.style.color = '';
                turnElement.style.backgroundColor = '';
                turnElement.style.padding = '';
                turnElement.style.borderRadius = '';
            }
        }
        
        // Only update if the fields are not in focus
        if (info.target) {
            const [ip, port] = (info.target || '').split(':');
            
            const ipAddressElement = document.getElementById('ipAddress');
            if (ipAddressElement && !ipAddressFieldHasFocus) {
                ipAddressElement.value = ip || '';
            }
            
            const portElement = document.getElementById('port');
            if (portElement && !portFieldHasFocus) {
                portElement.value = port || '';
            }
        }
    });
}

// Initialization when the popup is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Focus tracking for the input fields
    const ipAddressElement = document.getElementById('ipAddress');
    if (ipAddressElement) {
        ipAddressElement.addEventListener('focus', () => {
            ipAddressFieldHasFocus = true;
            console.log("Popup: IP Address field focused");
        });
        
        ipAddressElement.addEventListener('blur', () => {
            ipAddressFieldHasFocus = false;
            console.log("Popup: IP Address field lost focus");
        });
    }
    
    const portElement = document.getElementById('port');
    if (portElement) {
        portElement.addEventListener('focus', () => {
            portFieldHasFocus = true;
            console.log("Popup: Port field focused");
        });
        
        portElement.addEventListener('blur', () => {
            portFieldHasFocus = false;
            console.log("Popup: Port field lost focus");
        });
    }
    
    // Save-Button click handler
    const saveButton = document.getElementById('save');
    if (saveButton) {
        saveButton.onclick = () => {
            const ipAddress = document.getElementById('ipAddress').value;
            const port = document.getElementById('port').value;
            const target = `${ipAddress}:${port}`;
            
            console.log("Popup: Setting target to", target);
            chrome.runtime.sendMessage({ type: "SET_TARGET", target });
            
            // Show confirmation
            const originalText = saveButton.textContent;
            saveButton.textContent = "Saved!";
            setTimeout(() => {
                saveButton.textContent = originalText;
            }, 1000);
        };
    }
    
    // Initial update
    update();
    
    // Regular updates
    setInterval(update, 1000);
});