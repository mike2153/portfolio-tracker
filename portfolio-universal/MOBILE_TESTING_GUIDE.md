# Mobile Testing Guide for Portfolio Tracker

## Quick Start - Testing on iPhone with Expo Go

### Prerequisites
1. Install Expo Go from the App Store on your iPhone
2. Ensure your phone and computer are on the same Wi-Fi network
3. Have your environment variables ready from the main project

### Step 1: Set Up Environment Variables
1. Copy `.env.example` to `.env`
2. Fill in your credentials:
   ```bash
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
   EXPO_PUBLIC_ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
   EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_IP:8000
   ```

### Step 2: Find Your Computer's IP Address

#### Windows:
```bash
# Run the provided script
./start-expo.bat
```

#### Mac/Linux/WSL:
```bash
# Run the provided script
./start-expo.sh
```

The script will display your IP address. Update your `.env` file with:
```
EXPO_PUBLIC_API_URL=http://YOUR_IP_HERE:8000
```

### Step 3: Start the Backend
In the main portfolio-tracker directory:
```bash
# Using Docker
docker-compose up backend

# Or directly with Python
cd backend
python main.py
```

### Step 4: Start Expo Development Server
In the portfolio-universal directory:
```bash
npm start
# or
npx expo start --clear
```

### Step 5: Connect Your iPhone
1. Open Expo Go app on your iPhone
2. Scan the QR code displayed in your terminal
3. The app should load on your phone!

## Troubleshooting

### Connection Issues
- **"Network request failed"**: Make sure your backend is running and accessible
- **Blank screen**: Check console logs in terminal for errors
- **Can't scan QR code**: Try manual entry - tap "Enter URL manually" in Expo Go

### Common Fixes
1. Restart Metro bundler: Press `r` in terminal
2. Clear cache: `npx expo start --clear`
3. Check firewall isn't blocking port 8000
4. Verify both devices are on same network

### Debug Tips
- Shake your phone to open developer menu
- View logs in your terminal
- Check backend logs for API errors

## Next Steps

### Development Builds (for full features)
When you're ready for camera, push notifications, or other native features:
1. Install EAS CLI: `npm install -g eas-cli`
2. Configure EAS: `eas build:configure`
3. Create development build: `eas build --platform ios --profile development`

### TestFlight Distribution
For beta testing with others:
1. Requires Apple Developer account ($99/year)
2. Build for production: `eas build --platform ios`
3. Submit to TestFlight: `eas submit --platform ios`

## Platform-Specific Notes

### iOS
- Bundle ID: `com.portfoliotracker.universal`
- Minimum iOS version: 13.0
- Supports iPhone and iPad

### Android
- Package name: `com.portfoliotracker.universal`
- Minimum SDK: 21 (Android 5.0)

### Web
- Also works in browser: `npm run web`
- Responsive design adapts to screen size