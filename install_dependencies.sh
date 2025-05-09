#!/bin/bash

echo "Installing required Python dependencies..."

# Check if pip is installed
if ! command -v pip &> /dev/null; then
    echo "Error: pip is not installed. Please install pip first."
    exit 1
fi

# Install required packages
pip install opencv-python
pip install numpy
pip install ndi-python
pip install requests

echo "All dependencies have been installed successfully!" 