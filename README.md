# NPD - Notes, Productivity & Daily Planner

A powerful note-taking and task management app built with React, TypeScript, and Capacitor.

## Project Info

**URL**: https://lovable.dev/projects/c4920824-037c-4205-bb9e-d6cc0d5a0385  
**Play Store**: https://play.google.com/store/apps/details?id=nota.npd.com

## Technologies Used

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Capacitor (for native mobile apps)
- RevenueCat (for subscriptions)

## Getting Started

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to project directory
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm install

# Start development server
npm run dev
```

## Mobile Development Setup

### Prerequisites

- Node.js & npm installed
- For iOS: macOS with Xcode installed
- For Android: Android Studio installed

### Capacitor Setup

```sh
# Add iOS and Android platforms
npx cap add ios
npx cap add android

# Build the web app
npm run build

# Sync with native projects
npx cap sync

# Run on device/emulator
npx cap run android
npx cap run ios
```

## RevenueCat Subscription Setup

This app uses RevenueCat for managing subscriptions.

### Dependencies

The following RevenueCat packages are already installed:
- `@revenuecat/purchases-capacitor`
- `@revenuecat/purchases-capacitor-ui`

### Android Setup (build.gradle)

Add these dependencies to your `android/app/build.gradle`:

```groovy
android {
    // ... existing config

    defaultConfig {
        // ... existing config
        minSdkVersion 24
    }
}

dependencies {
    // RevenueCat
    implementation 'com.revenuecat.purchases:purchases:8.10.7'
    implementation 'com.revenuecat.purchases:purchases-ui:8.10.7'
    
    // Google Play Billing (required for subscriptions)
    implementation 'com.android.billingclient:billing:7.1.1'
    implementation 'com.android.billingclient:billing-ktx:7.1.1'
    
    // Required for RevenueCat
    implementation 'androidx.lifecycle:lifecycle-runtime-ktx:2.8.7'
    implementation 'androidx.lifecycle:lifecycle-process:2.8.7'
}
```

### Google Play Console Setup

1. **Create Products in Play Console**:
   - Go to Play Console → Your App → Monetize → Products → Subscriptions
   - Create subscription with ID: `monthly` (Monthly subscription)
   - Create subscription with ID: `yearly` (Yearly subscription with trial)

2. **RevenueCat Dashboard**:
   - Create products matching your Play Console product IDs
   - Create an entitlement named `npd Pro`
   - Create an offering with both products
   - Configure paywalls in RevenueCat dashboard

3. **API Keys**:
   - Get your Google API key from RevenueCat dashboard
   - The app uses: `goog_WLSvWlyHHLzNAgIfhCzAYsGaZyh`

### iOS Setup (if needed)

Add to your `ios/App/Podfile`:

```ruby
pod 'RevenueCat', '~> 5.14'
pod 'RevenueCatUI', '~> 5.14'
```

Then run:
```sh
cd ios/App && pod install
```

## Deployment

Simply open [Lovable](https://lovable.dev/projects/c4920824-037c-4205-bb9e-d6cc0d5a0385) and click on Share → Publish.

## Custom Domain

To connect a domain, navigate to Project → Settings → Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
