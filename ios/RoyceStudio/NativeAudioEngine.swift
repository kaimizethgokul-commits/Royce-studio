import AVFoundation

final class NativeAudioEngine {
    static let shared = NativeAudioEngine()

    private let engine = AVAudioEngine()
    private let sampleRate: Double = 48_000
    private var activePlayers: [AVAudioPlayerNode] = []
    private let vocalEQ = AVAudioUnitEQ(numberOfBands: 2)
    private let vocalReverb = AVAudioUnitReverb()
    private let vocalDelay = AVAudioUnitDelay()
    private let vocalMixer = AVAudioMixerNode()
    private var vocalGraphConnected = false
    private var monitoringEnabled = false

    private init() {
        vocalEQ.bands[0].filterType = .lowShelf
        vocalEQ.bands[0].frequency = 180
        vocalEQ.bands[0].gain = 0
        vocalEQ.bands[0].bypass = false

        vocalEQ.bands[1].filterType = .highShelf
        vocalEQ.bands[1].frequency = 6_500
        vocalEQ.bands[1].gain = 0
        vocalEQ.bands[1].bypass = false

        vocalReverb.loadFactoryPreset(.mediumHall)
        vocalReverb.wetDryMix = 12

        vocalDelay.delayTime = 0.22
        vocalDelay.feedback = 18
        vocalDelay.wetDryMix = 10

        vocalMixer.outputVolume = 0
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

    func setMonitoring(_ enabled: Bool) {
        requestMicrophoneAccess { [weak self] granted in
            guard let self else { return }
            guard granted else {
                self.monitoringEnabled = false
                self.vocalMixer.outputVolume = 0
                return
            }
            DispatchQueue.main.async {
                self.connectVocalGraphIfNeeded()
                self.monitoringEnabled = enabled
                self.vocalMixer.outputVolume = enabled ? max(self.vocalMixer.outputVolume, 0.85) : 0
                self.startIfNeeded()
            }
        }
    }

    func setVocalFX(
        volume: Float,
        lowEQ: Float,
        highEQ: Float,
        reverb: Float,
        delay: Float
    ) {
        let safeVolume = min(max(volume, 0), 1)
        let safeLow = min(max(lowEQ, -12), 12)
        let safeHigh = min(max(highEQ, -12), 12)
        let safeReverb = min(max(reverb, 0), 1)
        let safeDelay = min(max(delay, 0), 1)

        vocalEQ.bands[0].gain = safeLow
        vocalEQ.bands[1].gain = safeHigh
        vocalReverb.wetDryMix = safeReverb * 100
        vocalDelay.wetDryMix = safeDelay * 100

        if monitoringEnabled {
            vocalMixer.outputVolume = safeVolume
        }
    }

    private func requestMicrophoneAccess(_ completion: @escaping (Bool) -> Void) {
        let session = AVAudioSession.sharedInstance()
        switch session.recordPermission {
        case .granted:
            completion(true)
        case .denied:
            completion(false)
        case .undetermined:
            session.requestRecordPermission { granted in
                completion(granted)
            }
        @unknown default:
            completion(false)
        }
    }

    private func connectVocalGraphIfNeeded() {
        guard !vocalGraphConnected else { return }

        let input = engine.inputNode
        let format = input.inputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else { return }

        engine.attach(vocalEQ)
        engine.attach(vocalReverb)
        engine.attach(vocalDelay)
        engine.attach(vocalMixer)

        engine.connect(input, to: vocalEQ, format: format)
        engine.connect(vocalEQ, to: vocalReverb, format: format)
        engine.connect(vocalReverb, to: vocalDelay, format: format)
        engine.connect(vocalDelay, to: vocalMixer, format: format)
        engine.connect(vocalMixer, to: engine.mainMixerNode, format: format)

        vocalGraphConnected = true
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
