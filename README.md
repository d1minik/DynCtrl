# Chess Broadcast OBS Controller (DynCtrl)

This system provides automated OBS scene switching for chess tournament broadcasts based on which board is being shown and whose turn it is.

## System Overview

The system consists of two components:

1. **Board Tracking Tool**: Runs on the streamer's laptop and sends the current board and turn information to the Python server.
2. **Production PC Components**:
   - **Python Server (server.py)**: Receives and stores the current board and turn information.
   - **Web App Interface**: Connects to the Python server, fetches game data from Lichess, and controls OBS scene switching.

## Setup Instructions

### 1. Setup on the Production PC

1. Make sure Python 3.6+ is installed.
2. Run the server:
   ```
   python server.py
   ```
3. The server will ask for a port (default is 5000).
4. Note the IP address of your production PC for configuring the streamer's laptop tool.

5. Copy all the web app files to a folder on the production PC:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `server-connector.js`
   - `lichess-api.js`
   - `obs-connector.js`

6. Open `index.html` in a browser (Chrome recommended).

7. Connect to the Python server:
   - Enter the server URL (e.g., `http://127.0.0.1:5000` or `http://localhost:5000`)
   - Click "Connect"

8. Connect to OBS:
   - Make sure OBS Studio is running with the WebSocket server enabled
   - Enter the OBS WebSocket URL (default is `ws://127.0.0.1:4455`)
   - Enter the password if configured in OBS
   - Click "Connect to OBS"

9. Configure the scene mapping:
   - Click "Fetch Games from Lichess" to get all games in the tournament
   - For each board, select which OBS scene should be shown when white is to move and when black is to move
   - Click "Save Mapping" to store your configuration

### 2. Setup on the Streamer's Laptop

1. Configure your board tracking tool to send data to the production PC's Python server.
2. Use the production PC's IP address and the port number you selected when starting the server.

## How It Works

1. The tracking tool on the streamer's laptop sends board information to the Python server on the production PC.
2. The web app on the production PC continuously polls the Python server for updates.
3. When the board or turn changes, the web app automatically switches to the configured OBS scene.
4. The configuration persists between sessions, so you only need to set it up once per tournament.

## Requirements

- Python 3.6+ (for the server component)
- OBS Studio with WebSocket server enabled (v28+ recommended)
- Modern web browser (Chrome recommended)
- Network connectivity between the streamer's laptop and production PC

## Credits

- Error sound effect: [Pixabay - Error 8](https://pixabay.com/sound-effects/error-8-206492/)

## Troubleshooting

- **Cannot connect to server**: Check that the server is running and the IP/port is correct. Ensure there are no firewall issues.
- **Cannot connect to OBS**: Verify OBS is running with WebSocket server enabled. Check the WebSocket URL and password.
- **Scene not switching**: Check the scene mapping configuration and ensure both devices have network connectivity.
- **Missing games**: Verify the broadcast URL is correct and that the Lichess API is accessible. 