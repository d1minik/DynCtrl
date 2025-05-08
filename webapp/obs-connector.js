/**
 * OBSConnector - Vereinfachte Klasse zur Kommunikation mit OBS über WebSocket
 */
class OBSConnector {
    constructor() {
        // Basis-Eigenschaften
        this.socket = null;
        this.websocketUrl = '';
        this.password = '';
        this.scenes = [];
        this.connected = false;
        this.messageId = 1;
        this.callbacks = new Map();
        this.onConnectionChanged = null;
        
        // Flag, um gleichzeitige Szenenwechsel zu verhindern
        this.switchInProgress = false;
        
        // Logging in der Konsole aktivieren
        this.DEBUG_MODE = true;
    }

    /**
     * Verbindung zum OBS WebSocket herstellen
     * @param {string} url - WebSocket URL (z.B. ws://localhost:4455)
     * @param {string} password - OBS WebSocket Passwort
     * @returns {Promise<boolean>} - Erfolg der Verbindung
     */
    async connect(url, password) {
        try {
            // Bestehende Verbindung schließen
            this.disconnect();
            
            this.websocketUrl = url;
            this.password = password;
            this.logMessage(`Verbindung zu OBS WebSocket wird hergestellt: ${url}`, true);

            // Neue WebSocket-Verbindung erstellen
            this.socket = new WebSocket(url);
            
            // Event-Handler einrichten
            this.socket.onopen = this.handleOpen.bind(this);
            this.socket.onclose = this.handleClose.bind(this);
            this.socket.onerror = this.handleError.bind(this);
            this.socket.onmessage = this.handleMessage.bind(this);

            // Promise zurückgeben, das aufgelöst wird, wenn Authentifizierung erfolgreich ist
            return new Promise((resolve, reject) => {
                // Timeout für Verbindung setzen
                const timeout = setTimeout(() => {
                    reject(new Error('Verbindungs-Timeout'));
                }, 10000);

                // Callback speichern für Hello-Nachricht
                this.callbacks.set('hello', async (data) => {
                    clearTimeout(timeout);
                    
                    try {
                        const authenticated = await this.authenticate(data);
                        if (authenticated) {
                            // Szenenliste abrufen nach erfolgreicher Verbindung
                            await this.getScenes();
                            resolve(true);
                        } else {
                            reject(new Error('Authentifizierung fehlgeschlagen'));
                        }
                    } catch (err) {
                        reject(err);
                    }
                });
            });
        } catch (error) {
            this.logMessage(`Verbindungsfehler: ${error.message}`, true);
            this.connected = false;
            if (this.onConnectionChanged) {
                this.onConnectionChanged(false);
            }
            throw error;
        }
    }

    /**
     * Verbindung trennen und Status zurücksetzen
     */
    disconnect() {
        // Verbindung schließen falls vorhanden
        if (this.socket) {
            try {
                this.socket.close();
            } catch (e) {
                // Fehler ignorieren
            }
            this.socket = null;
        }
        
        // Status zurücksetzen
        this.scenes = [];
        this.connected = false;
        this.switchInProgress = false;
        this.callbacks.clear();
        this.messageId = 1;
        
        this.logMessage('Verbindung zu OBS WebSocket getrennt', true);
        
        // Callback für Verbindungsänderung aufrufen
        if (this.onConnectionChanged) {
            this.onConnectionChanged(false);
        }
    }

    /**
     * Event-Handler für WebSocket open Event
     */
    handleOpen(event) {
        this.logMessage('WebSocket-Verbindung hergestellt', true);
    }

    /**
     * Event-Handler für WebSocket close Event
     */
    handleClose(event) {
        this.connected = false;
        this.scenes = [];
        this.logMessage(`WebSocket-Verbindung geschlossen: ${event.code} ${event.reason}`, true);
        
        if (this.onConnectionChanged) {
            this.onConnectionChanged(false);
        }
    }

    /**
     * Event-Handler für WebSocket error Event
     */
    handleError(error) {
        this.logMessage(`WebSocket-Fehler: ${error}`, true);
        
        // Bei Fehlern Verbindungsstatus aktualisieren
        this.connected = false;
        if (this.onConnectionChanged) {
            this.onConnectionChanged(false);
        }
    }

    /**
     * Event-Handler für eingehende WebSocket-Nachrichten
     */
    handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            
            // Verschiedene Nachrichtentypen behandeln
            if (message.op === 0) {
                // Hello-Nachricht
                this.logMessage('Hello-Nachricht von OBS empfangen', true);
                const callback = this.callbacks.get('hello');
                if (callback) {
                    callback(message.d);
                    this.callbacks.delete('hello');
                }
            } else if (message.op === 2) {
                // Identified-Nachricht (Authentifizierung erfolgreich)
                this.connected = true;
                this.logMessage('Authentifizierung bei OBS erfolgreich', true);
                if (this.onConnectionChanged) {
                    this.onConnectionChanged(true);
                }
            } else if (message.op === 7) {
                // Antwort auf eine Anfrage
                const callback = this.callbacks.get(message.d.requestId);
                if (callback) {
                    callback(message.d);
                    this.callbacks.delete(message.d.requestId);
                }
            }
        } catch (error) {
            this.logMessage(`Fehler bei der Verarbeitung einer Nachricht: ${error.message}`, true);
        }
    }

    /**
     * Authentifizierung bei OBS durchführen
     * @param {Object} helloData - Daten aus der Hello-Nachricht
     * @returns {Promise<boolean>} - Erfolg der Authentifizierung
     */
    async authenticate(helloData) {
        try {
            const { authentication, rpcVersion } = helloData;
            
            if (rpcVersion !== 1) {
                throw new Error(`Nicht unterstützte RPC-Version: ${rpcVersion}`);
            }
            
            // Authentifizierung falls erforderlich
            if (authentication) {
                if (!this.password) {
                    throw new Error('Passwort für Authentifizierung erforderlich');
                }
                
                const authResponse = {
                    op: 1, // Identify operation
                    d: {
                        rpcVersion: 1,
                        authentication: this.password,
                        eventSubscriptions: 0 // Keine Events benötigt
                    }
                };
                
                this.socket.send(JSON.stringify(authResponse));
                return true;
            } else {
                // Keine Authentifizierung erforderlich
                const identifyPayload = {
                    op: 1,
                    d: {
                        rpcVersion: 1,
                        eventSubscriptions: 0
                    }
                };
                
                this.socket.send(JSON.stringify(identifyPayload));
                return true;
            }
        } catch (error) {
            this.logMessage(`Authentifizierungsfehler: ${error.message}`, true);
            return false;
        }
    }

    /**
     * Szenenliste von OBS abrufen
     * @returns {Promise<Array>} - Liste der verfügbaren Szenen
     */
    async getScenes() {
        try {
            if (!this.connected || !this.socket) {
                this.logMessage('Kann Szenen nicht abrufen: Nicht mit OBS verbunden');
                return [];
            }

            this.logMessage('Rufe Szenen von OBS ab...', true);
            const response = await this.sendRequest('GetSceneList');
            
            if (response && response.responseData && response.responseData.scenes) {
                // Szenenliste verarbeiten
                this.scenes = response.responseData.scenes
                    .map(scene => ({
                        name: scene.sceneName.trim(),
                        index: scene.sceneIndex
                    }))
                    .sort((a, b) => a.index - b.index);
                
                this.logMessage(`${this.scenes.length} Szenen von OBS abgerufen`, true);
                
                // Debug-Ausgabe der Szenen
                if (this.DEBUG_MODE) {
                    this.scenes.forEach((scene, idx) => {
                        this.logMessage(`Szene ${idx}: "${scene.name}" (OBS-Index: ${scene.index})`, false);
                    });
                }
                
                return this.scenes;
            } else {
                this.logMessage('Ungültige Antwort beim Abrufen der Szenen');
                this.scenes = [];
                throw new Error('Ungültige Antwort beim Abrufen der Szenen');
            }
        } catch (error) {
            this.logMessage(`Fehler beim Abrufen der Szenen: ${error.message}`, true);
            this.scenes = [];
            throw error;
        }
    }

    /**
     * Zu einer bestimmten Szene wechseln
     * @param {string} sceneName - Name der Zielszene
     * @returns {Promise<boolean>} - Erfolg des Szenenwechsels
     */
    async switchToScene(sceneName) {
        try {
            if (!this.connected || !this.socket) {
                this.logMessage(`Kann Szene nicht wechseln: Nicht mit OBS verbunden`, true);
                return false;
            }
            
            // Szenenwechsel abbrechen, falls bereits einer im Gange
            if (this.switchInProgress) {
                this.logMessage(`Szenenwechsel zu "${sceneName}" wird übersprungen - ein anderer Wechsel ist bereits aktiv`, true);
                return false;
            }
            
            this.switchInProgress = true;
            
            try {
                // Szenennamen normalisieren
                const normalizedSceneName = sceneName.trim();
                
                // Suche nach der Szene mit verschiedenen Methoden
                let sceneIndex = -1;
                let matchedScene = null;
                
                // 1. Exakte Übereinstimmung
                sceneIndex = this.scenes.findIndex(s => s.name === normalizedSceneName);
                
                // 2. Übereinstimmung ohne Berücksichtigung der Groß-/Kleinschreibung
                if (sceneIndex === -1) {
                    sceneIndex = this.scenes.findIndex(
                        s => s.name.toLowerCase() === normalizedSceneName.toLowerCase()
                    );
                }
                
                // 3. Teilübereinstimmung
                if (sceneIndex === -1) {
                    sceneIndex = this.scenes.findIndex(
                        s => s.name.toLowerCase().includes(normalizedSceneName.toLowerCase())
                    );
                }
                
                if (sceneIndex === -1) {
                    this.logMessage(`Szene "${normalizedSceneName}" nicht gefunden (${this.scenes.length} Szenen verfügbar)`, true);
                    
                    // Verfügbare Szenen ausgeben
                    if (this.scenes.length > 0) {
                        const availableScenes = this.scenes.map(s => `"${s.name}"`).join(', ');
                        this.logMessage(`Verfügbare Szenen: ${availableScenes}`, true);
                    }
                    
                    this.switchInProgress = false;
                    return false;
                }
                
                matchedScene = this.scenes[sceneIndex];
                this.logMessage(`Szene "${matchedScene.name}" gefunden für Anfrage "${normalizedSceneName}"`, true);
                
                // Prüfen, ob wir bereits auf der Szene sind
                try {
                    const currentResponse = await this.sendRequest('GetCurrentProgramScene');
                    if (currentResponse?.responseData?.currentProgramSceneName === matchedScene.name) {
                        this.logMessage(`Bereits auf Szene "${matchedScene.name}", kein Wechsel notwendig`, false);
                        this.switchInProgress = false;
                        return true;
                    }
                } catch (error) {
                    this.logMessage(`Fehler bei Prüfung der aktuellen Szene: ${error.message}`, false);
                }
                
                // Führe den eigentlichen Szenenwechsel durch
                this.logMessage(`Wechsle zu Szene: "${matchedScene.name}"`, true);
                
                await this.sendRequest('SetCurrentProgramScene', {
                    sceneName: matchedScene.name
                });
                
                // Kurze Verzögerung, um OBS Zeit zu geben, den Szenenwechsel durchzuführen
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // Überprüfen, ob der Szenenwechsel erfolgreich war
                const verifyResponse = await this.sendRequest('GetCurrentProgramScene');
                const actualScene = verifyResponse?.responseData?.currentProgramSceneName;
                
                if (actualScene === matchedScene.name) {
                    this.logMessage(`Szenenwechsel zu "${matchedScene.name}" erfolgreich`, true);
                    this.switchInProgress = false;
                    return true;
                } else {
                    this.logMessage(`Szenenwechsel fehlgeschlagen. Aktuelle Szene: "${actualScene}"`, true);
                    
                    // Ein zweiter Versuch
                    this.logMessage(`Zweiter Versuch...`, false);
                    await this.sendRequest('SetCurrentProgramScene', {
                        sceneName: matchedScene.name
                    });
                    
                    await new Promise(resolve => setTimeout(resolve, 300));
                    
                    const secondVerifyResponse = await this.sendRequest('GetCurrentProgramScene');
                    const secondActualScene = secondVerifyResponse?.responseData?.currentProgramSceneName;
                    
                    if (secondActualScene === matchedScene.name) {
                        this.logMessage(`Zweiter Versuch erfolgreich`, false);
                        this.switchInProgress = false;
                        return true;
                    } else {
                        this.logMessage(`Auch zweiter Versuch fehlgeschlagen. Aktuelle Szene: "${secondActualScene}"`, true);
                        this.switchInProgress = false;
                        return false;
                    }
                }
            } catch (error) {
                this.logMessage(`Fehler beim Szenenwechsel: ${error.message}`, true);
                this.switchInProgress = false;
                return false;
            }
        } catch (error) {
            this.logMessage(`Kritischer Fehler beim Szenenwechsel: ${error.message}`, true);
            this.switchInProgress = false;
            return false;
        }
    }

    /**
     * Anfrage an OBS senden
     * @param {string} requestType - Typ der Anfrage
     * @param {Object} requestData - Daten für die Anfrage
     * @returns {Promise<Object>} - Antwort von OBS
     */
    sendRequest(requestType, requestData = {}) {
        return new Promise((resolve, reject) => {
            if (!this.connected || !this.socket) {
                reject(new Error('Nicht mit OBS verbunden'));
                return;
            }
            
            const requestId = String(this.messageId++);
            
            const request = {
                op: 6, // Request operation
                d: {
                    requestType,
                    requestId,
                    requestData
                }
            };
            
            // Nur essentielle Anfragen loggen
            const isStatusCheck = requestType === 'GetCurrentProgramScene';
            if (!isStatusCheck && this.DEBUG_MODE) {
                this.logMessage(`Sende Anfrage an OBS - Typ: ${requestType}`, false);
            }
            
            // Timeout für die Anfrage einrichten
            const timeout = setTimeout(() => {
                this.callbacks.delete(requestId);
                this.logMessage(`Anfrage-Timeout - Typ: ${requestType}, ID: ${requestId}`, true);
                reject(new Error('Anfrage-Timeout'));
            }, 5000);
            
            // Callback für die Antwort speichern
            this.callbacks.set(requestId, (data) => {
                clearTimeout(timeout);
                
                // Fehler behandeln
                if (data.status === 'error') {
                    // Bei Szenenwechseln manchmal trotzdem erfolgreich auflösen
                    if (requestType === 'SetCurrentProgramScene') {
                        this.logMessage(`Hinweis: OBS hat einen Fehler zurückgegeben, aber die Szene könnte trotzdem gewechselt worden sein.`, false);
                        resolve({
                            status: 'ok',
                            responseData: {},
                            _wasErrorButResolved: true
                        });
                        return;
                    }
                    
                    reject(new Error(data.error || 'Unbekannter Fehler'));
                } else {
                    resolve(data);
                }
            });
            
            // Anfrage senden
            try {
                this.socket.send(JSON.stringify(request));
            } catch (error) {
                clearTimeout(timeout);
                this.callbacks.delete(requestId);
                this.logMessage(`Fehler beim Senden der Anfrage: ${error.message}`, true);
                reject(error);
            }
        });
    }

    /**
     * Nachricht in Log und Konsole ausgeben
     * @param {string} message - Nachricht
     * @param {boolean} isImportant - Wichtige Nachricht
     */
    logMessage(message, isImportant = false) {
        // In UI-Element loggen
        const logElement = document.getElementById('log');
        if (logElement) {
            const timestamp = new Date().toLocaleTimeString();
            if (isImportant) {
                logElement.innerHTML += `<span class="log-important">[${timestamp}] [OBS] ${message}</span>\n`;
            } else {
                logElement.innerHTML += `[${timestamp}] [OBS] ${message}\n`;
            }
            
            // Sicherstellen, dass Log-Container nach unten scrollt
            const logContainer = document.getElementById('log-container');
            if (logContainer) {
                logContainer.scrollTop = logContainer.scrollHeight;
            }
        }
        
        // In Konsole loggen
        if (this.DEBUG_MODE || isImportant) {
            console.log(`[OBS] ${message}`);
        }
    }

    /**
     * Callback für Verbindungsänderungen setzen
     * @param {Function} callback - Callback-Funktion
     */
    setConnectionChangedCallback(callback) {
        this.onConnectionChanged = callback;
    }
}

// Singleton-Instanz exportieren
const obsConnector = new OBSConnector();
