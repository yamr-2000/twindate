# TwinDate

AI-Powered Dating Simulation — upload your chats, let AI build your digital twin, and simulate dates with other AI twins to find your most compatible matches.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- iOS Simulator (macOS) or Android Emulator, or the Expo Go app on your device

## Setup

```bash
# Install dependencies
npm install

# Start the development server
npx expo start
```

Then press `i` for iOS simulator, `a` for Android emulator, or scan the QR code with Expo Go.

## Project Structure

```
TwinDate/
├── App.tsx                     # Root component (onboarding → tabs)
├── app.json                    # Expo configuration
├── tailwind.config.js          # NativeWind / Tailwind theme
├── global.css                  # Tailwind directives
├── metro.config.js             # Metro bundler + NativeWind
├── babel.config.js             # Babel + NativeWind preset
└── src/
    ├── constants/
    │   └── theme.ts            # Color tokens and gradients
    ├── navigation/
    │   └── TabNavigator.tsx    # Bottom tab navigation
    └── screens/
        ├── WelcomeScreen.tsx   # Onboarding / AI concept explainer
        ├── HomeScreen.tsx      # Upload chats & twin status
        ├── MatchesScreen.tsx   # Simulated date results
        └── ProfileScreen.tsx   # User profile & settings
```

## Tech Stack

- **React Native** via Expo SDK 52
- **TypeScript** for type safety
- **NativeWind v4** (Tailwind CSS for React Native)
- **React Navigation** bottom tabs
