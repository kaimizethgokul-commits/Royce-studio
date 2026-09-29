import AVFoundation

final class AudioSessionManager {
    static let shared = AudioSessionManager()
    private init() {}

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
}
