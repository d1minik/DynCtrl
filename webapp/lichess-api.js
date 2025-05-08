class LichessApi {
    constructor() {
        this.games = [];
    }

    async fetchBroadcastGames(broadcastUrl) {
        try {
            this.logMessage(`Fetching games from Lichess broadcast: ${broadcastUrl}`, true);
            
            // Extract the API URL from the broadcast URL
            const apiUrl = this.convertToApiUrl(broadcastUrl);
            
            if (!apiUrl) {
                throw new Error('Invalid broadcast URL format');
            }
            
            this.logMessage(`Using API URL: ${apiUrl}`, true);
            
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch broadcast data: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.games || !Array.isArray(data.games)) {
                throw new Error('Invalid response format: missing games array');
            }
            
            this.games = data.games.map((game, index) => {
                return {
                    boardNumber: index + 1,
                    id: game.id,
                    players: {
                        white: game.players[0].name,
                        black: game.players[1].name
                    },
                    status: game.status
                };
            });
            
            this.logMessage(`Successfully fetched ${this.games.length} games`, true);
            
            return this.games;
        } catch (error) {
            this.logMessage(`Error fetching broadcast games: ${error.message}`, true);
            throw error;
        }
    }

    convertToApiUrl(broadcastUrl) {
        // Check if the URL is in the expected format
        try {
            const url = new URL(broadcastUrl);
            
            // Extract path components
            const pathParts = url.pathname.split('/').filter(part => part.length > 0);
            
            if (pathParts.length < 3 || pathParts[0] !== 'broadcast') {
                throw new Error('Not a valid broadcast URL');
            }
            
            // Convert to API URL format
            return `https://lichess.org/api/broadcast/${pathParts[1]}/${pathParts[2]}/${pathParts[3]}`;
        } catch (error) {
            this.logMessage(`Error converting URL: ${error.message}`);
            return null;
        }
    }

    getGameById(gameId) {
        return this.games.find(game => game.id === gameId);
    }

    getGameByBoardNumber(boardNumber) {
        return this.games.find(game => game.boardNumber === boardNumber);
    }

    logMessage(message, isImportant = false) {
        const logElement = document.getElementById('log');
        if (logElement) {
            const timestamp = new Date().toLocaleTimeString();
            if (isImportant) {
                logElement.innerHTML += `<span class="log-important">[${timestamp}] [Lichess] ${message}</span>\n`;
            } else {
                logElement.innerHTML += `[${timestamp}] [Lichess] ${message}\n`;
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
        console.log(`[Lichess] ${message}`);
    }
}

// Export an instance of the API
const lichessApi = new LichessApi(); 