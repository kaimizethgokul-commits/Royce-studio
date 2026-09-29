import AVFoundation

final class AudioSessionManager {
    static let shared = AudioSessionManager()

    private init() {
        observeAudioSession()
    }

    func configure() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(
                .playAndRecord,
                mode: .default,
                options: [
                    .defaultToSpeaker,
                    .allowBluetooth,
                    .allowBluetoothA2DP
                ]
            )
            try session.setPreferredSampleRate(48_000)
            try session.setPreferredIOBufferDuration(0.005)
            try session.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            print("Royce Studio audio session error: \(error)")
        }
    }

    private func observeAudioSession() {
        let center = NotificationCenter.default
        let session = AVAudioSession.sharedInstance()

        center.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: session,
            queue: .main
        ) { [weak self] note in
            guard
                let info = note.userInfo,
                let rawType = info[AVAudioSessionInterruptionTypeKey] as? UInt,
                let type = AVAudioSession.InterruptionType(rawValue: rawType)
            else { return }

            if type == .ended {
                let rawOptions = info[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
                let options = AVAudioSession.InterruptionOptions(rawValue: rawOptions)
                if options.contains(.shouldResume) {
                    self?.configure()
                    NativeAudioEngine.shared.startIfNeeded()
                }
            }
        }

        center.addObserver(
            forName: AVAudioSession.routeChangeNotification,
            object: session,
            queue: .main
        ) { [weak self] _ in
            self?.configure()
            NativeAudioEngine.shared.startIfNeeded()
        }

        center.addObserver(
            forName: AVAudioSession.mediaServicesWereResetNotification,
            object: session,
            queue: .main
        ) { [weak self] _ in
            self?.configure()
            NativeAudioEngine.shared.startIfNeeded()
        }
    }
}
