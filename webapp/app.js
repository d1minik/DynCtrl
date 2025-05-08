// Main application class
class ChessOBSController {
    constructor() {
        this.currentBroadcastUrl = '';
        this.currentBoard = 0;
        this.totalBoards = 0;
        this.currentTurn = '';
        this.boardSceneMapping = new Map();
        this.activeGame = null;
        this.initialized = false;
        this.warnedScenes = new Set();
        this.manualDisconnect = {
            server: false,
            obs: false
        };
    }

    init() {
        if (this.initialized) return;
        this.initialized = true;

        // Set up event listeners
        document.getElementById('connect-server').addEventListener('click', this.connectToServer.bind(this));
        document.getElementById('connect-obs').addEventListener('click', this.connectToOBS.bind(this));
        document.getElementById('fetch-games').addEventListener('click', this.fetchGamesFromLichess.bind(this));
        document.getElementById('reset-mapping').addEventListener('click', this.resetMappingConfig.bind(this));
        document.getElementById('clear-log').addEventListener('click', this.clearLog.bind(this));
        document.getElementById('fetch-all').addEventListener('click', this.fetchAll.bind(this));
        document.getElementById('refresh-scenes').addEventListener('click', this.refreshScenes.bind(this));
        
        // Add Export/Import functionality
        document.getElementById('export-mapping').addEventListener('click', this.exportMapping.bind(this));
        document.getElementById('import-mapping').addEventListener('click', this.importMappingClick.bind(this));
        document.getElementById('import-mapping-file').addEventListener('change', this.importMapping.bind(this));

        // Set up callback handlers
        serverConnector.setUpdateCallback(this.handleServerUpdate.bind(this));
        serverConnector.setConnectionChangedCallback(this.handleServerConnectionChange.bind(this));
        obsConnector.setConnectionChangedCallback(this.handleOBSConnectionChange.bind(this));
        
        this.log('Application initialized');
        
        // Setup error checking
        this.setupConnectionMonitoring();
    }

    // Setup monitoring for connection losses
    setupConnectionMonitoring() {
        // Check for connection issues every 5 seconds
        setInterval(() => {
            this.updateConnectionStatus();
        }, 5000);
    }

    // Update the connection status and error message
    updateConnectionStatus() {
        const errorElement = document.getElementById('connection-error');
        const errorSound = document.getElementById('error-sound');
        let hasError = false;
        let errorMessage = 'Connection Error: ';
        let wasHidden = errorElement.classList.contains('hidden');
        
        // Check for server connection issues
        if (!serverConnector.connected && !this.manualDisconnect.server) {
            hasError = true;
            errorMessage += 'Python Server connection lost';
        }
        
        // Check for OBS connection issues
        if (!obsConnector.connected && !this.manualDisconnect.obs) {
            hasError = true;
            errorMessage += hasError ? ' and OBS connection lost' : 'OBS connection lost';
        }
        
        // Toggle error visibility
        if (hasError) {
            errorElement.textContent = errorMessage;
            errorElement.classList.remove('hidden');
            
            // Spiele Fehlersound ab, aber nur wenn die Meldung neu erscheint
            if (wasHidden && errorSound) {
                errorSound.currentTime = 0;
                errorSound.play().catch(e => {
                    console.warn('Could not play error sound:', e);
                });
            }
        } else {
            errorElement.classList.add('hidden');
        }
    }

    // Server connection
    async connectToServer() {
        // Get references
        const serverIp = document.getElementById('server-ip').value;
        const serverPort = document.getElementById('server-port').value;
        const serverUrl = `http://${serverIp}:${serverPort}`;
        const serverStatus = document.getElementById('server-status');
        const connectButton = document.getElementById('connect-server');
        
        // Check if we're already connected
        if (serverConnector.connected) {
            // Disconnect action
            this.manualDisconnect.server = true;
            serverConnector.disconnect();
            serverStatus.textContent = 'Disconnected';
            serverStatus.classList.remove('connected');
            connectButton.textContent = 'Connect';
            this.log('Disconnected from Python server', true);
            this.updateConnectionStatus();
            return;
        }
        
        // Connect action
        try {
            serverStatus.textContent = 'Connecting...';
            this.log('Connecting to Python server...', true);
            
            this.manualDisconnect.server = false;
            serverConnector.connect(serverUrl)
                .then(connected => {
                    if (connected) {
                        serverStatus.textContent = 'Connected';
                        serverStatus.classList.add('connected');
                        connectButton.textContent = 'Disconnect';
                        this.log('Connected to Python server successfully', true);
                    } else {
                        serverStatus.textContent = 'Connection Failed';
                        serverStatus.classList.remove('connected');
                        connectButton.textContent = 'Connect';
                        this.log('Failed to connect to Python server', true);
                    }
                    this.updateConnectionStatus();
                });
        } catch (error) {
            this.log(`Server connection error: ${error.message}`, true);
            serverStatus.textContent = 'Connection Failed';
            serverStatus.classList.remove('connected');
            connectButton.textContent = 'Connect';
            this.updateConnectionStatus();
        }
    }

    // Handle server connection status change
    handleServerConnectionChange(connected) {
        const serverStatus = document.getElementById('server-status');
        const connectButton = document.getElementById('connect-server');
        
        if (connected) {
            serverStatus.textContent = 'Connected';
            serverStatus.classList.add('connected');
            connectButton.textContent = 'Disconnect';
            this.log('Connection established with Python server', true);
        } else if (!this.manualDisconnect.server) {
            // Only update if it wasn't a manual disconnect
            serverStatus.textContent = 'Disconnected';
            serverStatus.classList.remove('connected');
            connectButton.textContent = 'Connect';
            this.log('Lost connection to Python server', true);
        }
        
        this.updateConnectionStatus();
    }

    // OBS connection
    async connectToOBS() {
        // Get references
        const obsIp = document.getElementById('obs-ip').value;
        const obsPort = document.getElementById('obs-port').value;
        const obsUrl = `ws://${obsIp}:${obsPort}`;
        const obsPassword = document.getElementById('obs-password').value;
        const obsStatus = document.getElementById('obs-status');
        const connectButton = document.getElementById('connect-obs');
        
        // Check if we're already connected
        if (obsConnector.connected) {
            // Disconnect action
            this.manualDisconnect.obs = true;
            obsConnector.disconnect();
            obsStatus.textContent = 'Disconnected';
            obsStatus.classList.remove('connected');
            connectButton.textContent = 'Connect to OBS';
            this.log('Disconnected from OBS', true);
            this.updateConnectionStatus();
            return;
        }
        
        // Connect action
        try {
            obsStatus.textContent = 'Connecting...';
            this.log('Connecting to OBS...', true);
            
            this.manualDisconnect.obs = false;
            await obsConnector.connect(obsUrl, obsPassword);
            
            // Connection success is handled in the callback, but we'll update button text here
            connectButton.textContent = 'Disconnect from OBS';
            this.updateConnectionStatus();
        } catch (error) {
            this.log(`OBS connection error: ${error.message}`, true);
            obsStatus.textContent = 'Connection Failed';
            obsStatus.classList.remove('connected');
            connectButton.textContent = 'Connect to OBS';
            this.updateConnectionStatus();
        }
    }

    // Handle OBS connection status change
    handleOBSConnectionChange(connected) {
        const obsStatus = document.getElementById('obs-status');
        const connectButton = document.getElementById('connect-obs');
        
        if (connected) {
            obsStatus.textContent = 'Connected';
            obsStatus.classList.add('connected');
            connectButton.textContent = 'Disconnect from OBS';
            this.log('Successfully connected to OBS', true);
            this.getAndPopulateScenes();
        } else if (!this.manualDisconnect.obs) {
            // Only update if it wasn't a manual disconnect
            obsStatus.textContent = 'Disconnected';
            obsStatus.classList.remove('connected');
            connectButton.textContent = 'Connect to OBS';
            this.log('Lost connection to OBS', true);
        }
        
        this.updateConnectionStatus();
    }

    // Get scenes and populate selects
    async getAndPopulateScenes() {
        try {
            await obsConnector.getScenes();
            this.populateSceneSelects();
            this.populateTestSceneSelect();
        } catch (error) {
            this.log(`Failed to get scenes: ${error.message}`, true);
        }
    }

    // Populate the game mapping table
    populateGamesMapping(games) {
        const tableBody = document.getElementById('mapping-body');
        tableBody.innerHTML = ''; // Clear existing rows

        games.forEach(game => {
            const row = document.createElement('tr');
            
            // Board number cell
            const boardCell = document.createElement('td');
            boardCell.textContent = game.boardNumber;
            row.appendChild(boardCell);
            
            // White player cell
            const whitePlayerCell = document.createElement('td');
            whitePlayerCell.textContent = game.players.white;
            row.appendChild(whitePlayerCell);
            
            // Black player cell
            const blackPlayerCell = document.createElement('td');
            blackPlayerCell.textContent = game.players.black;
            row.appendChild(blackPlayerCell);
            
            // White's turn scene select
            const whiteTurnCell = document.createElement('td');
            const whiteSelect = this.createSceneSelect(`white-${game.boardNumber}`);
            whiteTurnCell.appendChild(whiteSelect);
            row.appendChild(whiteTurnCell);
            
            // Black's turn scene select
            const blackTurnCell = document.createElement('td');
            const blackSelect = this.createSceneSelect(`black-${game.boardNumber}`);
            blackTurnCell.appendChild(blackSelect);
            row.appendChild(blackTurnCell);
            
            // Copy button cell
            const actionCell = document.createElement('td');
            const copyButton = document.createElement('button');
            copyButton.textContent = 'Copy';
            copyButton.className = 'copy-button';
            copyButton.setAttribute('data-board', game.boardNumber);
            copyButton.addEventListener('click', () => {
                this.copySceneSelection(game.boardNumber);
            });
            actionCell.appendChild(copyButton);
            row.appendChild(actionCell);
            
            tableBody.appendChild(row);
        });

        // Populate any saved mappings
        this.loadSavedMappings();
    }

    // Create a select element for scene selection
    createSceneSelect(id) {
        const select = document.createElement('select');
        select.id = id;
        
        // Add default empty option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '- default -';
        select.appendChild(defaultOption);
        
        // Add OBS scenes if available
        if (obsConnector.connected && obsConnector.scenes.length > 0) {
            obsConnector.scenes.forEach(scene => {
                const option = document.createElement('option');
                option.value = scene.name;
                option.textContent = scene.name;
                select.appendChild(option);
            });
        }
        
        // Add change event listener to auto-save
        select.addEventListener('change', () => {
            this.saveMappingConfig();
        });
        
        return select;
    }

    // Populate all scene selects with the available OBS scenes
    populateSceneSelects() {
        if (!obsConnector.connected) {
            this.log('Not connected to OBS');
            return;
        }

        if (!obsConnector.scenes || obsConnector.scenes.length === 0) {
            this.log('No OBS scenes available. Attempting to fetch scenes again...');
            obsConnector.getScenes().then(() => {
                this.populateSceneSelectsInternal();
                this.log(`Populated selects with ${obsConnector.scenes.length} scenes`);
            }).catch(error => {
                this.log(`Error fetching scenes: ${error.message}`);
            });
            return;
        }

        this.populateSceneSelectsInternal();
        this.log(`Populated selects with ${obsConnector.scenes.length} scenes`);
    }

    // Internal method to populate selects
    populateSceneSelectsInternal() {
        // Get all select elements for scenes
        const selects = document.querySelectorAll('select[id^="white-"], select[id^="black-"]');
        
        selects.forEach(select => {
            // Save current value
            const currentValue = select.value;
            
            // Clear all options
            select.innerHTML = '';
            
            // Add default empty option
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = '- default -';
            select.appendChild(defaultOption);
            
            // Add all scenes
            if (obsConnector.scenes && obsConnector.scenes.length > 0) {
                obsConnector.scenes.forEach(scene => {
                    const option = document.createElement('option');
                    option.value = scene.name;
                    option.textContent = scene.name;
                    select.appendChild(option);
                });
                
                // Restore previously selected value if it exists in the new options
                if (currentValue) {
                    select.value = currentValue;
                }
            } else {
                this.log('Warning: No scenes available to populate select boxes');
            }
            
            // Add change event listener to auto-save (only add if not already present)
            const hasChangeListener = select._hasChangeListener;
            if (!hasChangeListener) {
                select.addEventListener('change', () => {
                    this.saveMappingConfig();
                });
                select._hasChangeListener = true;
            }
        });
    }

    // Save the current mapping configuration
    saveMappingConfig() {
        try {
            const config = {};
            
            // Get all scene selects
            const whiteSelects = document.querySelectorAll('select[id^="white-"]');
            const blackSelects = document.querySelectorAll('select[id^="black-"]');
            
            // Process white turn selections
            whiteSelects.forEach(select => {
                if (select.value) {
                    const boardNumber = select.id.split('-')[1];
                    if (!config[boardNumber]) config[boardNumber] = {};
                    config[boardNumber].white = select.value;
                }
            });
            
            // Process black turn selections
            blackSelects.forEach(select => {
                if (select.value) {
                    const boardNumber = select.id.split('-')[1];
                    if (!config[boardNumber]) config[boardNumber] = {};
                    config[boardNumber].black = select.value;
                }
            });
            
            // Save to local storage
            localStorage.setItem('chessObsMappings', JSON.stringify(config));
            
            // Update internal mapping
            this.boardSceneMapping = new Map(Object.entries(config));
            
            this.log('Mapping configuration saved', true);
        } catch (error) {
            this.log(`Error saving mapping: ${error.message}`, true);
        }
    }

    // Load saved mappings from local storage
    loadSavedMappings() {
        try {
            const savedConfig = localStorage.getItem('chessObsMappings');
            
            if (savedConfig) {
                const config = JSON.parse(savedConfig);
                
                // Set values in select elements
                for (const [boardNumber, scenes] of Object.entries(config)) {
                    if (scenes.white) {
                        const whiteSelect = document.getElementById(`white-${boardNumber}`);
                        if (whiteSelect) whiteSelect.value = scenes.white;
                    }
                    
                    if (scenes.black) {
                        const blackSelect = document.getElementById(`black-${boardNumber}`);
                        if (blackSelect) blackSelect.value = scenes.black;
                    }
                }
                
                // Update internal mapping
                this.boardSceneMapping = new Map(Object.entries(config));
                
                this.log('Loaded saved mappings', true);
            }
        } catch (error) {
            this.log(`Error loading saved mappings: ${error.message}`, true);
        }
    }

    // Check if we need to switch scenes based on current board and turn
    checkForSceneSwitch() {
        if (!obsConnector.connected) {
            // Don't log every time, as this is called frequently
            return;
        }
        
        if (this.boardSceneMapping.size === 0) {
            // Don't log every time, as this is called frequently
            return;
        }

        // Get mapping for current board
        const boardConfig = this.boardSceneMapping.get(String(this.currentBoard));
        
        if (!boardConfig) {
            // No mapping for this board
            return;
        }

        // Determine which scene to use based on turn
        let targetScene = null;
        
        if (this.currentTurn === 'white' && boardConfig.white) {
            targetScene = boardConfig.white;
        } else if (this.currentTurn === 'black' && boardConfig.black) {
            targetScene = boardConfig.black;
        }
        
        if (!targetScene) {
            // No scene mapping for this turn
            return;
        }
        
        // Check if the scene exists in OBS
        const sceneExists = obsConnector.scenes.some(scene => {
            // Verbesserte Szenensuche, auch Teilübereinstimmungen erlauben
            return scene.name === targetScene || 
                   scene.name.toLowerCase() === targetScene.toLowerCase() ||
                   scene.name.toLowerCase().includes(targetScene.toLowerCase());
        });
        
        if (!sceneExists) {
            // Only log this warning once per scene (store warnings in a Set)
            if (!this.warnedScenes) this.warnedScenes = new Set();
            
            if (!this.warnedScenes.has(targetScene)) {
                this.log(`Warning: Mapped scene "${targetScene}" does not exist in OBS`, true);
                this.warnedScenes.add(targetScene);
            }
            return;
        }

        // Only switch scenes if we're tracking a different game or scene than before
        const newGameKey = `${this.currentBoard}-${this.currentTurn}`;
        
        // Speichere den aktuellen Spielstatus, um bei Race Conditions zu erkennen,
        // ob wir immer noch den selben Zustand haben, wenn der async Aufruf zurückkommt
        const currentBoardSnapshot = this.currentBoard;
        const currentTurnSnapshot = this.currentTurn;
        
        // Only switch scenes if we're tracking a different game or scene than before
        if (this.activeGame !== newGameKey) {
            // Instead of logging every attempt, just log when we actually start a switch
            this.log(`Switching to board ${this.currentBoard}, ${this.currentTurn}'s turn, scene: ${targetScene}`, true);
            
            // Use direct call instead of async wrapper to ensure it happens
            obsConnector.switchToScene(targetScene)
                .then(success => {
                    // Überprüfen, ob sich der Zustand zwischenzeitlich geändert hat
                    if (this.currentBoard !== currentBoardSnapshot || this.currentTurn !== currentTurnSnapshot) {
                        this.log(`State changed during scene switch: was B${currentBoardSnapshot}/${currentTurnSnapshot}, now B${this.currentBoard}/${this.currentTurn}`, true);
                        // Nicht activeGame aktualisieren, damit der neue Zustand sofort einen neuen Switch triggern kann
                        return;
                    }
                    
                    if (success) {
                        this.activeGame = newGameKey;
                        this.log(`Successfully switched to scene: ${targetScene}`, true);
                    } else {
                        this.log(`Failed to switch to scene: ${targetScene}`, true);
                    }
                })
                .catch(error => {
                    this.log(`Error in scene switch: ${error.message}`, true);
                });
        }
    }
    
    // Helper method to get the current OBS scene
    async getCurrentOBSScene() {
        try {
            const response = await obsConnector.sendRequest('GetCurrentProgramScene');
            if (response && response.responseData && response.responseData.currentProgramSceneName) {
                return response.responseData.currentProgramSceneName;
            }
        } catch (error) {
            // Ignore errors
        }
        return null;
    }

    // Clear log function
    clearLog() {
        const logElement = document.getElementById('log');
        if (logElement) {
            logElement.innerHTML = '';
            this.log('Log cleared', true);
        }
    }

    // Helper for logging
    log(message, isImportant = false) {
        const logElement = document.getElementById('log');
        if (logElement) {
            const timestamp = new Date().toLocaleTimeString();
            if (isImportant) {
                logElement.innerHTML += `<span class="log-important">[${timestamp}] [App] ${message}</span>\n`;
                
                // Spiele Fehlersound für wichtige Meldungen ab, die Fehler enthalten
                const errorSound = document.getElementById('error-sound');
                if (errorSound && (
                    message.toLowerCase().includes('error') ||
                    message.toLowerCase().includes('failed') ||
                    message.toLowerCase().includes('fehler') ||
                    message.toLowerCase().includes('nicht gefunden') ||
                    message.toLowerCase().includes('fehlgeschlagen')
                )) {
                    // Sound zurücksetzen und abspielen
                    errorSound.currentTime = 0;
                    errorSound.play().catch(e => {
                        console.warn('Could not play error sound:', e);
                    });
                }
            } else {
                logElement.innerHTML += `[${timestamp}] [App] ${message}\n`;
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
        console.log(`[App] ${message}`);
    }

    // Reset mapping configuration
    resetMappingConfig() {
        try {
            // Clear the mapping in memory
            this.boardSceneMapping = new Map();
            
            // Remove from local storage
            localStorage.removeItem('chessObsMappings');
            
            // Reset all selects to default
            const selects = document.querySelectorAll('select[id^="white-"], select[id^="black-"]');
            selects.forEach(select => {
                select.value = '';
            });
            
            this.log('All mappings have been reset', true);
        } catch (error) {
            this.log(`Error resetting mappings: ${error.message}`, true);
        }
    }

    // Fetch all games and scenes
    async fetchAll() {
        this.log('Starting Fetch All operation...', true);
        
        // Step 1: Connect to Python server
        const serverIp = document.getElementById('server-ip').value;
        const serverPort = document.getElementById('server-port').value;
        const serverUrl = `http://${serverIp}:${serverPort}`;
        const serverStatus = document.getElementById('server-status');
        const connectButton = document.getElementById('connect-server');
        
        // Only connect if not already connected
        if (!serverConnector.connected) {
            try {
                serverStatus.textContent = 'Connecting...';
                this.log('Connecting to Python server...', true);
                await serverConnector.connect(serverUrl);
                
                if (serverConnector.connected) {
                    serverStatus.textContent = 'Connected';
                    serverStatus.classList.add('connected');
                    connectButton.textContent = 'Disconnect';
                    this.log('Connected to Python server successfully', true);
                } else {
                    serverStatus.textContent = 'Connection Failed';
                    serverStatus.classList.remove('connected');
                    this.log('Failed to connect to server. Cannot fetch games.', true);
                    return;
                }
            } catch (error) {
                this.log(`Server connection error: ${error.message}`, true);
                serverStatus.textContent = 'Connection Failed';
                serverStatus.classList.remove('connected');
                return;
            }
        }
        
        // Add a delay to allow the server connection to stabilize
        this.log('Waiting for connection to stabilize...', true);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Step 2: Fetch games
        if (!this.currentBroadcastUrl) {
            this.log('Waiting for broadcast URL...', true);
            // Wait for another second to see if the broadcast URL arrives
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (!this.currentBroadcastUrl) {
                this.log('No broadcast URL available. Cannot fetch games.', true);
                return;
            }
        }
        
        try {
            this.log('Fetching games from broadcast...', true);
            const games = await lichessApi.fetchBroadcastGames(this.currentBroadcastUrl);
            this.populateGamesMapping(games);
            this.log(`Successfully fetched ${games.length} games from broadcast`, true);
        } catch (error) {
            this.log(`Error fetching games: ${error.message}`, true);
            return;
        }
        
        // Step 3: Connect to OBS if needed and get scenes
        if (!obsConnector.connected) {
            this.log('Connecting to OBS for Fetch All...', true);
            const obsIp = document.getElementById('obs-ip').value;
            const obsPort = document.getElementById('obs-port').value;
            const obsUrl = `ws://${obsIp}:${obsPort}`;
            const obsPassword = document.getElementById('obs-password').value;
            const obsStatus = document.getElementById('obs-status');
            const connectButton = document.getElementById('connect-obs');
            
            try {
                obsStatus.textContent = 'Connecting...';
                await obsConnector.connect(obsUrl, obsPassword);
                
                // The OBS connection callback will handle the rest of setup
                connectButton.textContent = 'Disconnect from OBS';
            } catch (error) {
                this.log(`OBS connection error during Fetch All: ${error.message}`, true);
                this.log('Fetch All completed with OBS connection errors', true);
                return;
            }
        } else {
            // If already connected, just get the scenes
            this.log('OBS already connected, fetching scenes...', true);
            await this.getAndPopulateScenes();
        }
        
        this.log('Fetch All completed successfully', true);
    }

    // Refresh OBS scenes
    async refreshScenes() {
        if (!obsConnector.connected) {
            this.log('Cannot refresh scenes: Not connected to OBS', true);
            return;
        }

        this.log('Refreshing OBS scenes...', true);
        try {
            await this.getAndPopulateScenes();
            this.log('OBS scenes refreshed successfully', true);
        } catch (error) {
            this.log(`Failed to refresh scenes: ${error.message}`, true);
        }
    }

    // Populate test scene select for direct testing
    populateTestSceneSelect() {
        const testSceneSelect = document.getElementById('test-scene');
        if (!testSceneSelect) return;
        
        // Clear existing options
        testSceneSelect.innerHTML = '';
        
        // Add all scenes
        if (obsConnector.scenes && obsConnector.scenes.length > 0) {
            obsConnector.scenes.forEach(scene => {
                const option = document.createElement('option');
                option.value = scene.name;
                option.textContent = scene.name;
                testSceneSelect.appendChild(option);
            });
            
            this.log(`Populated test scene select with ${obsConnector.scenes.length} scenes`, true);
        } else {
            this.log('No scenes available for test selector', true);
        }
    }

    // Server update handler
    handleServerUpdate(data) {
        // Update display with information from the server
        this.currentBroadcastUrl = data.broadcastUrl || '';
        this.currentBoard = (typeof data.boardNumber === 'number' ? data.boardNumber : (parseInt(data.boardNumber, 10) || 1));
        this.totalBoards = data.totalBoards || 0;
        this.currentTurn = data.turn || '';

        // Log server update - kept simple with only essential info
        this.log(`Server update: Board=${this.currentBoard}, Turn=${this.currentTurn}`, false);

        // Update the UI
        const broadcastElement = document.getElementById('broadcast-url');
        if (this.currentBroadcastUrl) {
            broadcastElement.innerHTML = `<a href="${this.currentBroadcastUrl}" target="_blank">${this.currentBroadcastUrl}</a>`;
        } else {
            broadcastElement.textContent = '-';
        }
        
        document.getElementById('current-board').textContent = this.currentBoard;
        document.getElementById('total-boards').textContent = this.totalBoards;
        document.getElementById('current-turn').textContent = this.currentTurn;

        // If we have mappings, check if we need to switch scenes
        if (this.boardSceneMapping && this.boardSceneMapping.size > 0 && obsConnector.connected) {
            this.checkForSceneSwitch();
        }
    }

    // Fetch games from Lichess
    async fetchGamesFromLichess() {
        // Check if we're connected to the server
        if (!serverConnector.connected) {
            this.log('Not connected to server. Attempting to connect...', true);
            // Try to connect to server first
            const serverIp = document.getElementById('server-ip').value;
            const serverPort = document.getElementById('server-port').value;
            const serverUrl = `http://${serverIp}:${serverPort}`;
            const serverStatus = document.getElementById('server-status');
            const connectButton = document.getElementById('connect-server');
            
            try {
                serverStatus.textContent = 'Connecting...';
                const connected = await serverConnector.connect(serverUrl);
                
                if (connected) {
                    serverStatus.textContent = 'Connected';
                    serverStatus.classList.add('connected');
                    connectButton.textContent = 'Disconnect';
                    this.log('Connected to Python server successfully', true);
                } else {
                    serverStatus.textContent = 'Connection Failed';
                    serverStatus.classList.remove('connected');
                    this.log('Failed to connect to server. Cannot fetch games.', true);
                    return;
                }
            } catch (error) {
                this.log(`Server connection error: ${error.message}`, true);
                serverStatus.textContent = 'Connection Failed';
                serverStatus.classList.remove('connected');
                return;
            }
        }

        if (!this.currentBroadcastUrl) {
            this.log('No broadcast URL available. Connect to server first.', true);
            return;
        }

        try {
            this.log('Fetching games from broadcast...', true);
            const games = await lichessApi.fetchBroadcastGames(this.currentBroadcastUrl);
            this.populateGamesMapping(games);
            this.log(`Successfully fetched ${games.length} games from broadcast`, true);
        } catch (error) {
            this.log(`Error fetching games: ${error.message}`, true);
        }
    }

    // Copy scene selection between white and black
    copySceneSelection(boardNumber) {
        try {
            const whiteSelect = document.getElementById(`white-${boardNumber}`);
            const blackSelect = document.getElementById(`black-${boardNumber}`);
            
            if (!whiteSelect || !blackSelect) {
                this.log(`Error: Could not find select elements for board ${boardNumber}`, true);
                return;
            }
            
            // If white has a selection and black is on default, copy white to black
            if (whiteSelect.value && !blackSelect.value) {
                blackSelect.value = whiteSelect.value;
                this.log(`Copied white scene to black for board ${boardNumber}`, true);
            } 
            // If black has a selection and white is on default, copy black to white
            else if (!whiteSelect.value && blackSelect.value) {
                whiteSelect.value = blackSelect.value;
                this.log(`Copied black scene to white for board ${boardNumber}`, true);
            }
            // If both have selections, copy white to black
            else if (whiteSelect.value && blackSelect.value) {
                blackSelect.value = whiteSelect.value;
                this.log(`Copied white scene to black for board ${boardNumber}`, true);
            }
            // If neither has a selection, nothing to copy
            else {
                this.log(`Nothing to copy for board ${boardNumber}`, true);
                return;
            }
            
            // Save the updated configuration
            this.saveMappingConfig();
        } catch (error) {
            this.log(`Error copying scene selection: ${error.message}`, true);
        }
    }

    // Export mapping configuration to a text file
    exportMapping() {
        try {
            // Get the current mapping configuration
            const config = {};
            
            // Get all scene selects
            const whiteSelects = document.querySelectorAll('select[id^="white-"]');
            const blackSelects = document.querySelectorAll('select[id^="black-"]');
            
            // Process white turn selections
            whiteSelects.forEach(select => {
                const boardNumber = select.id.split('-')[1];
                if (!config[boardNumber]) config[boardNumber] = {};
                config[boardNumber].white = select.value || '';
            });
            
            // Process black turn selections
            blackSelects.forEach(select => {
                const boardNumber = select.id.split('-')[1];
                if (!config[boardNumber]) config[boardNumber] = {};
                config[boardNumber].black = select.value || '';
            });
            
            // Convert to formatted text
            let exportText = "Board | White Scene | Black Scene\n";
            exportText += "------|-------------|------------\n";
            
            Object.entries(config).forEach(([boardNumber, scenes]) => {
                exportText += `${boardNumber} | ${scenes.white || '-'} | ${scenes.black || '-'}\n`;
            });
            
            // Create a Blob and download link
            const blob = new Blob([exportText], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'scene_mapping.txt';
            a.click();
            
            URL.revokeObjectURL(url);
            
            this.log('Mapping configuration exported', true);
        } catch (error) {
            this.log(`Error exporting mapping: ${error.message}`, true);
        }
    }
    
    // Trigger file input click for import
    importMappingClick() {
        document.getElementById('import-mapping-file').click();
    }
    
    // Import mapping configuration from a text file
    importMapping(event) {
        try {
            const file = event.target.files[0];
            if (!file) {
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const lines = text.split('\n');
                    
                    // Skip header lines
                    let startIndex = 0;
                    for (let i = 0; i < lines.length; i++) {
                        if (lines[i].includes('------|')) {
                            startIndex = i + 1;
                            break;
                        }
                    }
                    
                    const config = {};
                    
                    // Parse each data line
                    for (let i = startIndex; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (!line) continue;
                        
                        const parts = line.split('|').map(part => part.trim());
                        if (parts.length < 3) continue;
                        
                        const boardNumber = parts[0];
                        const whiteScene = parts[1] !== '-' ? parts[1] : '';
                        const blackScene = parts[2] !== '-' ? parts[2] : '';
                        
                        config[boardNumber] = {
                            white: whiteScene,
                            black: blackScene
                        };
                    }
                    
                    // Update select elements
                    for (const [boardNumber, scenes] of Object.entries(config)) {
                        const whiteSelect = document.getElementById(`white-${boardNumber}`);
                        const blackSelect = document.getElementById(`black-${boardNumber}`);
                        
                        if (whiteSelect && scenes.white) {
                            whiteSelect.value = scenes.white;
                        }
                        
                        if (blackSelect && scenes.black) {
                            blackSelect.value = scenes.black;
                        }
                    }
                    
                    // Save the updated configuration
                    this.saveMappingConfig();
                    
                    this.log('Mapping configuration imported', true);
                } catch (error) {
                    this.log(`Error parsing import file: ${error.message}`, true);
                }
            };
            
            reader.readAsText(file);
            
            // Reset the file input so the same file can be selected again
            event.target.value = '';
        } catch (error) {
            this.log(`Error importing mapping: ${error.message}`, true);
        }
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new ChessOBSController();
    app.init();
    
    // Set up a MutationObserver to ensure the log always scrolls to bottom when content changes
    const logContainer = document.getElementById('log-container');
    const logElement = document.getElementById('log');
    
    if (logContainer && logElement) {
        const observer = new MutationObserver(() => {
            logContainer.scrollTop = logContainer.scrollHeight;
        });
        
        observer.observe(logElement, { 
            childList: true,
            characterData: true,
            subtree: true 
        });
    }
}); 