try:
    import cv2
except ImportError:
    print("OpenCV (cv2) module not found. Please install it using: pip install opencv-python")
    exit(1)
try:
    import numpy as np
except ImportError:
    print("NumPy module not found. Please install it using: pip install numpy")
    exit(1)

try:
    import NDIlib
except ImportError:
    print("NDIlib module not found. Please install it using: pip install ndi-python")
    exit(1)

try:
    import json
except ImportError:
    print("JSON module not found. This should be included with Python.")
    exit(1)

try:
    import requests
except ImportError:
    print("Requests module not found. Please install it using: pip install requests") 
    exit(1)

import time
from typing import Dict, List, Tuple

def initialize_ndi() -> bool:
    """Initialize NDI library."""
    if not NDIlib.initialize():
        print("Failed to initialize NDI")
        return False
    return True

def find_ndi_sources() -> List[Tuple[int, str]]:
    """Find all available NDI sources in the network."""
    sources = []
    ndi_find = NDIlib.FindCreate()
    
    if ndi_find is None:
        return sources
    
    while True:
        sources_found = NDIlib.FindGetSources(ndi_find, 1000)
        if not sources_found:
            break
            
        for i, source in enumerate(sources_found, start=1):
            sources.append((i, source.name))
    
    NDIlib.FindDestroy(ndi_find)
    return sources

def create_ndi_receiver(source_name: str) -> Tuple[NDIlib.ReceiveInstance, NDIlib.VideoFrame]:
    """Create an NDI receiver for the specified source."""
    settings = NDIlib.ReceiveCreate()
    settings.source_to_connect_to = NDIlib.Source(source_name)
    settings.ndi_recv_name = 'Presence Detector'
    
    ndi_recv = NDIlib.recv_create_v3(settings)
    video_frame = NDIlib.VideoFrameV2()
    
    return ndi_recv, video_frame

def detect_person(frame: np.ndarray) -> bool:
    """Detect if a person is present in the frame using OpenCV."""
    # Convert frame to grayscale
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    # Load the pre-trained HOG person detector
    hog = cv2.HOGDescriptor()
    hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
    
    # Detect people in the frame
    boxes, weights = hog.detectMultiScale(gray, 
                                        winStride=(8, 8),
                                        padding=(4, 4),
                                        scale=1.05)
    
    # If any person is detected with high confidence
    return len(boxes) > 0 and any(w > 0.5 for w in weights)

def send_presence_data(server_url: str, data: Dict) -> bool:
    """Send presence data to the server via HTTP POST."""
    try:
        response = requests.post(server_url, json=data)
        return response.status_code == 200
    except Exception as e:
        print(f"Error sending data: {e}")
        return False

def main():
    if not initialize_ndi():
        return
    
    # Find and display available NDI sources
    sources = find_ndi_sources()
    if not sources:
        print("No NDI sources found!")
        return
    
    print("\nNDI sources found:")
    for idx, name in sources:
        print(f"[{idx}] {name}")
    
    # Get user input for source selection
    selected_indices = input("\nEnter the indices of cameras to monitor (comma-separated): ").split(',')
    selected_indices = [int(idx.strip()) for idx in selected_indices if idx.strip().isdigit()]
    
    # Get server URL
    server_url = input("\nEnter server URL (e.g., http://localhost:5000/presence): ")
    
    # Create receivers for selected sources
    receivers = []
    for idx in selected_indices:
        if 1 <= idx <= len(sources):
            source_name = sources[idx-1][1]
            receiver, frame = create_ndi_receiver(source_name)
            receivers.append((receiver, frame, source_name, idx))
    
    print("\nStarting presence detection... Press Ctrl+C to stop")
    
    try:
        while True:
            for receiver, frame, source_name, idx in receivers:
                # Receive frame
                if NDIlib.recv_capture_v2(receiver, frame, None, None, 1000):
                    # Convert NDI frame to OpenCV format
                    cv_frame = np.copy(frame.data)
                    
                    # Detect person
                    person_present = detect_person(cv_frame)
                    
                    # Send data to server
                    data = {
                        "index": idx,
                        "ndi_name": source_name,
                        "player_present": person_present
                    }
                    
                    if send_presence_data(server_url, data):
                        print(f"Camera {idx} ({source_name}): {'Person detected' if person_present else 'No person'}")
                    
                    NDIlib.recv_free_video_v2(receiver, frame)
            
            time.sleep(1)  # Prevent excessive CPU usage
            
    except KeyboardInterrupt:
        print("\nStopping presence detection...")
    finally:
        # Cleanup
        for receiver, _, _, _ in receivers:
            NDIlib.recv_destroy(receiver)
        NDIlib.destroy()

if __name__ == "__main__":
    main() 