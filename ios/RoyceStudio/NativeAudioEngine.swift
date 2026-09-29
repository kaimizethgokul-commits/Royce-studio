import AVFoundation

final class NativeAudioEngine {
    static let shared = NativeAudioEngine()

    private let engine = AVAudioEngine()
    private let sampleRate: Double = 48_000
    private var activePlayers: [AVAudioPlayerNode] = []

    private init() {
        startIfNeeded()
    }

    func startIfNeeded() {
        AudioSessionManager.shared.configure()
        guard !engine.isRunning else { return }
        do {
            try engine.start()
        } catch {
            print("Royce native audio engine failed to start: \(error)")
        }
    }

    func playDrum(_ name: String) {
        startIfNeeded()
        let duration: Double
        switch name {
        case "kick": duration = 0.28
        case "snare": duration = 0.18
        case "hat", "rim": duration = 0.09
        case "crash": duration = 0.65
        default: duration = 0.2
        }

        playGenerated(duration: duration) { [sampleRate] frame, total in
            let t = Double(frame) / sampleRate
            let progress = Double(frame) / Double(max(total - 1, 1))
            let env = Float(pow(max(0, 1 - progress), name == "crash" ? 2.0 : 4.0))

            switch name {
            case "kick":
                let freq = 150.0 - (105.0 * progress)
                return Float(sin(2 * .pi * freq * t)) * env * 0.9
            case "snare":
                let noise = Float.random(in: -1...1)
                let tone = Float(sin(2 * .pi * 180 * t))
                return (noise * 0.72 + tone * 0.28) * env * 0.62
            case "hat":
                return Float.random(in: -1...1) * env * 0.28
            case "clap":
                let burst = sin(progress * .pi * 18) > 0 ? 1.0 : 0.25
                return Float.random(in: -1...1) * env * Float(burst) * 0.5
            case "tom":
                return Float(sin(2 * .pi * (120 - 35 * progress) * t)) * env * 0.65
            case "rim":
                return Float(sin(2 * .pi * 720 * t)) * env * 0.34
            case "perc":
                return Float(sin(2 * .pi * (430 - 90 * progress) * t)) * env * 0.42
            case "crash":
                return Float.random(in: -1...1) * env * 0.3
            default:
                return 0
            }
        }
    }

    func playTone(
        frequency: Double,
        waveform: String = "sine",
        duration: Double = 0.55,
        gain: Double = 0.16
    ) {
        startIfNeeded()
        let safeFrequency = min(max(frequency, 20), 16_000)
        let safeDuration = min(max(duration, 0.05), 5)
        let safeGain = Float(min(max(gain, 0.01), 0.8))

        playGenerated(duration: safeDuration) { [sampleRate] frame, total in
            let t = Double(frame) / sampleRate
            let phase = 2 * Double.pi * safeFrequency * t
            let progress = Double(frame) / Double(max(total - 1, 1))
            let attack = min(1.0, progress / 0.03)
            let release = min(1.0, (1.0 - progress) / 0.18)
            let env = Float(max(0, min(attack, release)))

            let wave: Float
            switch waveform {
            case "square":
                wave = sin(phase) >= 0 ? 1 : -1
            case "sawtooth":
                let cycle = (safeFrequency * t).truncatingRemainder(dividingBy: 1)
                wave = Float((2 * cycle) - 1)
            case "triangle":
                let cycle = (safeFrequency * t).truncatingRemainder(dividingBy: 1)
                wave = Float(1 - 4 * abs(cycle - 0.5))
            default:
                wave = Float(sin(phase))
            }
            return wave * env * safeGain
        }
    }

    private func playGenerated(
        duration: Double,
        generator: @escaping (_ frame: Int, _ totalFrames: Int) -> Float
    ) {
        let frames = max(1, Int(sampleRate * duration))
        guard
            let format = AVAudioFormat(
                standardFormatWithSampleRate: sampleRate,
                channels: 2
            ),
            let buffer = AVAudioPCMBuffer(
                pcmFormat: format,
                frameCapacity: AVAudioFrameCount(frames)
            )
        else { return }

        buffer.frameLength = AVAudioFrameCount(frames)
        guard let channels = buffer.floatChannelData else { return }

        for frame in 0..<frames {
            let sample = generator(frame, frames)
            channels[0][frame] = sample
            channels[1][frame] = sample
        }

        let player = AVAudioPlayerNode()
        engine.attach(player)
        engine.connect(player, to: engine.mainMixerNode, format: format)
        activePlayers.append(player)

        player.scheduleBuffer(buffer, at: nil, options: []) { [weak self, weak player] in
            guard let self, let player else { return }
            DispatchQueue.main.async {
                player.stop()
                self.engine.detach(player)
                self.activePlayers.removeAll { $0 === player }
            }
        }
        player.play()
    }
}
