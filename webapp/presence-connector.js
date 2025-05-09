class PresenceConnector {
    constructor() {
        this.serverUrl = '';
        this.interval = null;
        this.onUpdate = null;
        this.connected = false;
        this.connectionCallback = null;
    }

    connect(url) {
        this.serverUrl = url;
        this.logMessage(`Connecting to presence server at ${url}`, true);
        
        // Test connection
        return fetch(url)
            .then(response => {
                if (response.ok) {
                    this.connected = true;
                    this.logMessage('Successfully connected to presence server', true);
                    this.startPolling();
                    
                    // Notify via callback
                    if (this.connectionCallback) {
                        this.connectionCallback(true);
                    }
                    
                    return true;
                } else {
                    throw new Error(`Presence server connection failed: ${response.status}`);
                }
            })
            .catch(error => {
                this.logMessage(`Error connecting to presence server: ${error.message}`, true);
                this.connected = false;
                
                // Notify via callback
                if (this.connectionCallback) {
                    this.connectionCallback(false);
                }
                
                return false;
            });
    }

    disconnect() {
        this.stopPolling();
        this.connected = false;
        this.logMessage('Disconnected from presence server', true);
        
        // Notify via callback
        if (this.connectionCallback) {
            this.connectionCallback(false);
        }
    }

    startPolling() {
        this.stopPolling(); // Clear any existing intervals
        
        // Poll server every .5 seconds for updates
        this.interval = setInterval(() => {
            this.getPresenceInfo();
        }, 500);
        
        this.logMessage('Started polling presence server for updates');
    }

    stopPolling() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            this.logMessage('Stopped polling presence server');
        }
    }

    getPresenceInfo() {
        fetch(this.serverUrl + '/presence', { method: 'GET' })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to get presence status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // If we weren't connected before, update connection status
                if (!this.connected) {
                    this.connected = true;
                    if (this.connectionCallback) {
                        this.connectionCallback(true);
                    }
                }
                
                // Call the callback with the updated data
                if (this.onUpdate) {
                    this.onUpdate(data);
                }
            })
            .catch(error => {
                this.logMessage(`Error polling presence server: ${error.message}`);
                
                // If this is a connection failure and we were previously connected
                if (this.connected) {
                    this.connected = false;
                    this.logMessage('Lost connection to presence server', true);
                    
                    // Notify via callback
                    if (this.connectionCallback) {
                        this.connectionCallback(false);
                    }
                }
            });
    }

    setUpdateCallback(callback) {
        this.onUpdate = callback;
    }
    
    setConnectionChangedCallback(callback) {
        this.connectionCallback = callback;
    }

    logMessage(message, isImportant = false) {
        const logElement = document.getElementById('log');
        if (logElement) {
            const timestamp = new Date().toLocaleTimeString();
            if (isImportant) {
                logElement.innerHTML += `<span class="log-important">[${timestamp}] [Presence] ${message}</span>\n`;
            } else {
                logElement.innerHTML += `[${timestamp}] [Presence] ${message}\n`;
            }
            
            // Ensure the log container scrolls to the bottom
            const logContainer = document.getElementById('log-container');
            if (logContainer) {
                // Force a reflow to ensure scrollHeight is updated
                logContainer.scrollTop = logContainer.scrollHeight;
                
                // Use setTimeout to ensure the scroll happens after the DOM update
                setTimeout(() => {
                    logContainer.scrollTop = logContainer.scrollHeight;
                }, 0);
            }
        }
        console.log(`[Presence] ${message}`);
    }
}

// Export an instance of the connector
const presenceConnector = new PresenceConnector(); 