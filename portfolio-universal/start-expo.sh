#!/bin/bash

# Find the local IP address
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    LOCAL_IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1)
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux/WSL
    LOCAL_IP=$(hostname -I | awk '{print $1}')
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # Windows Git Bash
    LOCAL_IP=$(ipconfig | grep -A 10 "Wireless LAN adapter Wi-Fi" | grep "IPv4" | awk '{print $NF}')
fi

echo "================================================"
echo "Portfolio Tracker - Expo Development Server"
echo "================================================"
echo ""
echo "Your local IP address is: $LOCAL_IP"
echo ""
echo "IMPORTANT: Update the .env file with:"
echo "EXPO_PUBLIC_API_URL=http://$LOCAL_IP:8000"
echo ""
echo "Make sure your phone and computer are on the same network!"
echo ""
echo "Starting Expo..."
echo "================================================"

# Start expo with the tunnel option for easier connectivity
npx expo start --clear