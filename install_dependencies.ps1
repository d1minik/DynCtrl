Write-Host "Installing required Python dependencies..." -ForegroundColor Cyan

# Check if pip is installed
try {
    $pipVersion = python -m pip --version
    Write-Host "Found pip: $pipVersion" -ForegroundColor Green
} catch {
    Write-Host "Error: pip is not installed. Please install pip first." -ForegroundColor Red
    exit 1
}

# Install required packages
Write-Host "Installing packages..." -ForegroundColor Yellow
python -m pip install opencv-python
python -m pip install numpy
python -m pip install ndi-python
python -m pip install requests

Write-Host "All dependencies have been installed successfully!" -ForegroundColor Green 