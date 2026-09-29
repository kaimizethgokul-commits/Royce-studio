# Royce Studio for iOS

This folder contains the native iPhone shell for Royce Studio.

## What it adds

- SwiftUI iPhone app
- WKWebView studio host
- Native AVAudioSession configured for playback + vocal recording
- Speaker, Bluetooth and Bluetooth A2DP routing
- Microphone capture permission handling
- Reload if the web-content process is terminated
- iPhone portrait and landscape support

## Generate the Xcode project

On a Mac with Xcode installed:

1. Install XcodeGen.
2. In Terminal, open this `ios` folder.
3. Run `xcodegen generate`.
4. Open `RoyceStudio.xcodeproj`.
5. Select your Apple developer team under Signing & Capabilities.
6. Connect an iPhone and press Run.

The current native shell loads:
`https://royce-studio-psi.vercel.app/?native=ios`

The next iOS milestone is moving latency-sensitive recording, monitoring and pitch processing from the web layer into native AVAudioEngine code.
