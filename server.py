from http.server import BaseHTTPRequestHandler, HTTPServer
import json

# Store the latest board information
latest_board_info = {
    "broadcastUrl": "",
    "boardNumber": "",
    "totalBoards": "",
    "turn": ""
}

class SimpleHTTPRequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Handle different paths
        if self.path == '/status':
            # Return the latest board info as JSON
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(latest_board_info).encode())
        else:
            # Default response for root
            self.send_response(200)
            self.send_header("Content-type", "text/plain")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(b"Server is running!")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        global latest_board_info
        
        print("--------------------------------")
        print("POST request received")  # Debugging
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        print("Raw POST data:", post_data)  # Debugging
        try:
            board_info = json.loads(post_data)
            print("Parsed board info:", board_info)  # Debugging
            
            # Update the latest board info
            latest_board_info = {
                "broadcastUrl": board_info.get('broadcastUrl', ''),
                "boardNumber": board_info.get('boardNumber', ''),
                "totalBoards": board_info.get('totalBoards', ''),
                "turn": board_info.get('turn', '')
            }
            
            # Print a summary
            print(f"\nbroadcast: {latest_board_info['broadcastUrl']} \nboard: {latest_board_info['boardNumber']}/{latest_board_info['totalBoards']} | turn: {latest_board_info['turn']}\n")
            
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(b'{"status": "success"}')
            print("--------------------------------\n")
        except json.JSONDecodeError as e:
            print("JSON decode error:", e)  # Debugging
            self.send_response(400)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(b'{"status": "error", "message": "Invalid JSON"}')

if __name__ == "__main__":
    user_input_ip = input("select local ip (default is 0.0.0.0): ")

    if user_input_ip.strip() == "":
        ip = "0.0.0.0"
    else:
        ip = user_input_ip


    user_input_port = input("select local port (default is 5000): ")
    
    # Default port if user input is empty
    if user_input_port.strip() == "":
        port = 5000
    else:
        port = int(user_input_port)

    server_address = (ip, port)
    httpd = HTTPServer(server_address, SimpleHTTPRequestHandler)
    print(f"\nServer running on {ip}:{port}\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped")
    finally:
        httpd.server_close()
        print("Server closed")
