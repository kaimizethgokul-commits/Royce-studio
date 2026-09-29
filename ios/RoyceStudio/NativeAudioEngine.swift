import AVFoundation

final class NativeAudioEngine {
    static let shared = NativeAudioEngine()

    private let engine = AVAudioEngine()
    private let sampleRate: Double = 48_000
    private var activePlayers: [AVAudioPlayerNode] = []
    private var mediaPlayers: [String: AVAudioPlayerNode] = [:]
    private var mediaFiles: [String: AVAudioFile] = [:]
    private var mediaLoop: [String: Bool] = [:]
    private let instrumentMixer = AVAudioMixerNode()
    private let instrumentEQ = AVAudioUnitEQ(numberOfBands: 2)
    private var instrumentGraphConnected = false
    private var compressionAmount: Float = 0.2
    private let metronomePlayer = AVAudioPlayerNode()
    private var metronomeAttached = false
    private var metronomeVolume: Float = 0.22

    private let deckAPlayer = AVAudioPlayerNode()
    private let deckBPlayer = AVAudioPlayerNode()
    private let deckAPitch = AVAudioUnitTimePitch()
    private let deckBPitch = AVAudioUnitTimePitch()
    private let deckAEQ = AVAudioUnitEQ(numberOfBands: 1)
    private let deckBEQ = AVAudioUnitEQ(numberOfBands: 1)
    private let deckAMixer = AVAudioMixerNode()
    private let deckBMixer = AVAudioMixerNode()
    private var deckAFile: AVAudioFile?
    private var deckBFile: AVAudioFile?
    private var djGraphConnected = false

    private let vocalEQ = AVAudioUnitEQ(numberOfBands: 2)
    private let vocalPitch = AVAudioUnitTimePitch()
    private let vocalReverb = AVAudioUnitReverb()
    private let vocalDelay = AVAudioUnitDelay()
    private let vocalMixer = AVAudioMixerNode()
    private var vocalGraphConnected = false
    private var monitoringEnabled = false
    private var vocalFader: Float = 0.85
    private var monitorLevel: Float = 0.85
    private var recordingFile: AVAudioFile?
    private var lastRecordingURL: URL?
    private var isRecording = false
    private var autoTuneEnabled = false
    private var tuneKey = 0
    private var tuneScale = "major"
    private var tuneStrength: Float = 0.70
    private var tuneRetuneMs: Float = 35
    private var tuneHumanize: Float = 0.20
    private var currentPitchCorrection: Float = 0
    private var pitchTapInstalled = false
    private var masterRecordingFile: AVAudioFile?
    private var lastMasterURL: URL?
    private var isMasterRecording = false

    var lastTakeURL: URL? {
        lastRecordingURL
    }

    var lastMasterCaptureURL: URL? {
        lastMasterURL
    }

    private init() {
        instrumentEQ.bands[0].filterType = .lowShelf
        instrumentEQ.bands[0].frequency = 180
        instrumentEQ.bands[0].gain = 0
        instrumentEQ.bands[0].bypass = false

        instrumentEQ.bands[1].filterType = .highShelf
        instrumentEQ.bands[1].frequency = 6_500
        instrumentEQ.bands[1].gain = 0
        instrumentEQ.bands[1].bypass = false

        deckAEQ.bands[0].filterType = .lowPass
        deckAEQ.bands[0].frequency = 12_000
        deckAEQ.bands[0].bypass = false
        deckBEQ.bands[0].filterType = .lowPass
        deckBEQ.bands[0].frequency = 12_000
        deckBEQ.bands[0].bypass = false

        deckAPitch.pitch = 0
        deckAPitch.rate = 1
        deckAPitch.overlap = 8
        deckBPitch.pitch = 0
        deckBPitch.rate = 1
        deckBPitch.overlap = 8

        deckAMixer.outputVolume = 0.707
        deckBMixer.outputVolume = 0.707

        vocalEQ.bands[0].filterType = .lowShelf
        vocalEQ.bands[0].frequency = 180
        vocalEQ.bands[0].gain = 0
        vocalEQ.bands[0].bypass = false

        vocalEQ.bands[1].filterType = .highShelf
        vocalEQ.bands[1].frequency = 6_500
        vocalEQ.bands[1].gain = 0
        vocalEQ.bands[1].bypass = false

        vocalPitch.pitch = 0
        vocalPitch.rate = 1
        vocalPitch.overlap = 8

        vocalReverb.loadFactoryPreset(.mediumHall)
        vocalReverb.wetDryMix = 12

        vocalDelay.delayTime = 0.22
        vocalDelay.feedback = 18
        vocalDelay.wetDryMix = 10

        vocalMixer.outputVolume = 0
        connectInstrumentGraphIfNeeded()
        connectMetronomeIfNeeded()
        connectDJGraphIfNeeded()
        startIfNeeded()
    }

    func startIfNeeded() {
        AudioSessionManager.shared.configure()
        connectInstrumentGraphIfNeeded()
        connectMetronomeIfNeeded()
        connectDJGraphIfNeeded()
        guard !engine.isRunning else { return }
        do {
            try engine.start()
        } catch {
            print("Royce native audio engine failed to start: \(error)")
        }
    }

    private func connectMetronomeIfNeeded() {
        guard !metronomeAttached else { return }
        connectInstrumentGraphIfNeeded()
        engine.attach(metronomePlayer)
        engine.connect(metronomePlayer, to: instrumentMixer, format: nil)
        metronomePlayer.volume = metronomeVolume
        metronomeAttached = true
    }

    func startMetronome(bpm: Double) {
        startIfNeeded()
        connectMetronomeIfNeeded()

        let safeBPM = min(max(bpm, 40), 220)
        let secondsPerBeat = 60.0 / safeBPM
        let beatsPerBar = 4
        let framesPerBeat = max(1, Int(sampleRate * secondsPerBeat))
        let totalFrames = framesPerBeat * beatsPerBar

        guard
            let format = AVAudioFormat(
                standardFormatWithSampleRate: sampleRate,
                channels: 2
            ),
            let buffer = AVAudioPCMBuffer(
                pcmFormat: format,
                frameCapacity: AVAudioFrameCount(totalFrames)
            )
        else { return }

        buffer.frameLength = AVAudioFrameCount(totalFrames)
        guard let channels = buffer.floatChannelData else { return }

        for channel in 0..<2 {
            for frame in 0..<totalFrames {
                channels[channel][frame] = 0
            }
        }

        let clickFrames = max(1, Int(sampleRate * 0.045))
        for beat in 0..<beatsPerBar {
            let start = beat * framesPerBeat
            let frequency = beat == 0 ? 1_250.0 : 850.0
            let amplitude: Float = beat == 0 ? 0.42 : 0.28

            for i in 0..<clickFrames where start + i < totalFrames {
                let t = Double(i) / sampleRate
                let progress = Double(i) / Double(clickFrames)
                let envelope = Float(pow(max(0, 1 - progress), 4))
                let sample = Float(sin(2 * Double.pi * frequency * t))
                    * envelope
                    * amplitude

                channels[0][start + i] = sample
                channels[1][start + i] = sample
            }
        }

        metronomePlayer.stop()
        metronomePlayer.scheduleBuffer(
            buffer,
            at: nil,
            options: [.loops]
        )
        metronomePlayer.volume = metronomeVolume
        metronomePlayer.play()
    }

    func stopMetronome() {
        metronomePlayer.stop()
    }

    func setMetronomeVolume(_ value: Float) {
        metronomeVolume = min(max(value, 0), 1)
        metronomePlayer.volume = metronomeVolume
    }

    func setMixer(
        instrumentVolume: Float,
        instrumentPan: Float,
        instrumentLowEQ: Float,
        instrumentHighEQ: Float,
        vocalVolume: Float,
        vocalPan: Float,
        masterVolume: Float,
        compression: Float,
        limiterCeiling: Float
    ) {
        connectInstrumentGraphIfNeeded()

        let safeInstrumentVolume = min(max(instrumentVolume, 0), 1)
        instrumentMixer.pan = min(max(instrumentPan, -1), 1)
        instrumentEQ.bands[0].gain = min(max(instrumentLowEQ, -12), 12)
        instrumentEQ.bands[1].gain = min(max(instrumentHighEQ, -12), 12)
        compressionAmount = min(max(compression, 0), 1)
        // Safe native compression approximation: progressively lower bus headroom
        // while preserving the user's fader position. This avoids unsupported
        // DynamicsProcessor classes on iOS.
        let compressionTrim = 1.0 - (compressionAmount * 0.18)
        instrumentMixer.outputVolume = min(
            max(safeInstrumentVolume * compressionTrim, 0),
            1
        )

        vocalFader = min(max(vocalVolume, 0), 1)
        vocalMixer.pan = min(max(vocalPan, -1), 1)
        if monitoringEnabled {
            vocalMixer.outputVolume = vocalFader * monitorLevel
        }

        let ceilingDB = min(max(limiterCeiling, -6.0), 0.0)
        let ceilingGain = Float(pow(10.0, Double(ceilingDB) / 20.0))
        engine.mainMixerNode.outputVolume = min(
            max(masterVolume, 0.0),
            ceilingGain
        )
    }

    private func connectInstrumentGraphIfNeeded() {
        guard !instrumentGraphConnected else { return }

        engine.attach(instrumentMixer)
        engine.attach(instrumentEQ)

        engine.connect(instrumentMixer, to: instrumentEQ, format: nil)
        engine.connect(instrumentEQ, to: engine.mainMixerNode, format: nil)

        instrumentGraphConnected = true
    }

    private func connectDJGraphIfNeeded() {
        guard !djGraphConnected else { return }
        connectInstrumentGraphIfNeeded()

        engine.attach(deckAPlayer)
        engine.attach(deckBPlayer)
        engine.attach(deckAPitch)
        engine.attach(deckBPitch)
        engine.attach(deckAEQ)
        engine.attach(deckBEQ)
        engine.attach(deckAMixer)
        engine.attach(deckBMixer)

        engine.connect(deckAPlayer, to: deckAPitch, format: nil)
        engine.connect(deckAPitch, to: deckAEQ, format: nil)
        engine.connect(deckAEQ, to: deckAMixer, format: nil)
        engine.connect(deckAMixer, to: instrumentMixer, format: nil)

        engine.connect(deckBPlayer, to: deckBPitch, format: nil)
        engine.connect(deckBPitch, to: deckBEQ, format: nil)
        engine.connect(deckBEQ, to: deckBMixer, format: nil)
        engine.connect(deckBMixer, to: instrumentMixer, format: nil)

        djGraphConnected = true
    }

    @discardableResult
    func loadDeck(deck: String, url: URL) -> Bool {
        startIfNeeded()
        guard let file = try? AVAudioFile(forReading: url) else { return false }

        if deck.uppercased() == "A" {
            deckAPlayer.stop()
            deckAFile = file
            scheduleDeckA()
        } else {
            deckBPlayer.stop()
            deckBFile = file
            scheduleDeckB()
        }
        return true
    }

    func toggleDeck(_ deck: String) {
        let upper = deck.uppercased()
        let player = upper == "A" ? deckAPlayer : deckBPlayer
        let hasFile = upper == "A" ? deckAFile != nil : deckBFile != nil
        guard hasFile else { return }

        if player.isPlaying {
            player.pause()
        } else {
            player.play()
        }
    }

    func cueDeck(_ deck: String) {
        let upper = deck.uppercased()
        if upper == "A" {
            guard deckAFile != nil else { return }
            deckAPlayer.stop()
            scheduleDeckA()
        } else {
            guard deckBFile != nil else { return }
            deckBPlayer.stop()
            scheduleDeckB()
        }
    }

    func setDeckPitch(_ deck: String, semitones: Float) {
        let cents = min(max(semitones, -12), 12) * 100
        if deck.uppercased() == "A" {
            deckAPitch.pitch = cents
        } else {
            deckBPitch.pitch = cents
        }
    }

    func setDeckFilter(_ deck: String, frequency: Float) {
        let safe = min(max(frequency, 80), 18_000)
        if deck.uppercased() == "A" {
            deckAEQ.bands[0].frequency = safe
        } else {
            deckBEQ.bands[0].frequency = safe
        }
    }

    func setCrossfader(_ value: Float) {
        let x = min(max(value, -1), 1)
        let angle = Double((x + 1) * Float.pi / 4)
        deckAMixer.outputVolume = Float(cos(angle))
        deckBMixer.outputVolume = Float(sin(angle))
    }

    private func scheduleDeckA() {
        guard let file = deckAFile else { return }
        deckAPlayer.scheduleFile(file, at: nil)
    }

    private func scheduleDeckB() {
        guard let file = deckBFile else { return }
        deckBPlayer.scheduleFile(file, at: nil)
    }

    func toggleMedia(
        id: String,
        url: URL,
        volume: Float,
        loop: Bool
    ) {
        startIfNeeded()

        if let player = mediaPlayers[id] {
            if player.isPlaying {
                player.pause()
            } else {
                player.play()
            }
            player.volume = min(max(volume, 0), 1)
            mediaLoop[id] = loop
            return
        }

        guard let file = try? AVAudioFile(forReading: url) else { return }

        let player = AVAudioPlayerNode()
        player.volume = min(max(volume, 0), 1)

        engine.attach(player)
        engine.connect(
            player,
            to: instrumentMixer,
            format: file.processingFormat
        )

        mediaPlayers[id] = player
        mediaFiles[id] = file
        mediaLoop[id] = loop

        scheduleMedia(id: id)
        player.play()
    }

    func stopMedia(id: String) {
        guard let player = mediaPlayers[id] else { return }
        player.stop()
        engine.detach(player)
        mediaPlayers.removeValue(forKey: id)
        mediaFiles.removeValue(forKey: id)
        mediaLoop.removeValue(forKey: id)
    }

    func setMediaVolume(id: String, volume: Float) {
        mediaPlayers[id]?.volume = min(max(volume, 0), 1)
    }

    func setMediaLoop(id: String, loop: Bool) {
        mediaLoop[id] = loop
    }

    private func scheduleMedia(id: String) {
        guard
            let player = mediaPlayers[id],
            let file = mediaFiles[id]
        else { return }

        let frameCount = AVAudioFrameCount(
            min(Int64(UInt32.max), file.length)
        )

        player.scheduleSegment(
            file,
            startingFrame: 0,
            frameCount: frameCount,
            at: nil
        ) { [weak self] in
            guard let self else { return }
            DispatchQueue.main.async {
                guard self.mediaPlayers[id] === player else { return }
                if self.mediaLoop[id] == true {
                    self.scheduleMedia(id: id)
                    if !player.isPlaying {
                        player.play()
                    }
                } else {
                    self.stopMedia(id: id)
                }
            }
        }
    }

    func startMasterCapture() {
        guard !isMasterRecording else { return }
        startIfNeeded()

        let mixer = engine.mainMixerNode
        let format = mixer.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else { return }

        let directory = FileManager.default.urls(
            for: .documentDirectory,
            in: .userDomainMask
        ).first!
        let url = directory.appendingPathComponent(
            "Royce-Master-\(Int(Date().timeIntervalSince1970)).caf"
        )

        do {
            let file = try AVAudioFile(
                forWriting: url,
                settings: format.settings
            )
            masterRecordingFile = file
            lastMasterURL = url
            isMasterRecording = true

            mixer.installTap(
                onBus: 0,
                bufferSize: 2_048,
                format: format
            ) { [weak self] buffer, _ in
                guard let self, self.isMasterRecording else { return }
                try? self.masterRecordingFile?.write(from: buffer)
            }
        } catch {
            print("Royce master capture start error: \(error)")
            masterRecordingFile = nil
            isMasterRecording = false
        }
    }

    func stopMasterCapture() {
        guard isMasterRecording else { return }
        engine.mainMixerNode.removeTap(onBus: 0)
        isMasterRecording = false
        masterRecordingFile = nil
    }

    func playLastMasterCapture() {
        guard let url = lastMasterURL,
              let file = try? AVAudioFile(forReading: url) else { return }

        startIfNeeded()
        let player = AVAudioPlayerNode()
        engine.attach(player)
        engine.connect(
            player,
            to: engine.mainMixerNode,
            format: file.processingFormat
        )
        activePlayers.append(player)

        player.scheduleFile(file, at: nil) { [weak self, weak player] in
            guard let self, let player else { return }
            DispatchQueue.main.async {
                player.stop()
                self.engine.detach(player)
                self.activePlayers.removeAll { $0 === player }
            }
        }
        player.play()
    }

    func setAutoTune(
        enabled: Bool,
        key: String,
        scale: String,
        strength: Float,
        retuneMs: Float,
        humanize: Float
    ) {
        autoTuneEnabled = enabled
        tuneKey = Self.pitchClass(for: key)
        tuneScale = scale == "minor" ? "minor" : "major"
        tuneStrength = min(max(strength, 0), 1)
        tuneRetuneMs = min(max(retuneMs, 5), 120)
        tuneHumanize = min(max(humanize, 0), 1)

        requestMicrophoneAccess { [weak self] granted in
            guard let self, granted else { return }
            DispatchQueue.main.async {
                self.connectVocalGraphIfNeeded()
                if enabled {
                    self.installPitchTrackingIfNeeded()
                } else {
                    self.currentPitchCorrection = 0
                    self.vocalPitch.pitch = 0
                }
                self.startIfNeeded()
            }
        }
    }

    private static func pitchClass(for key: String) -> Int {
        switch key {
        case "C#": return 1
        case "D": return 2
        case "D#": return 3
        case "E": return 4
        case "F": return 5
        case "F#": return 6
        case "G": return 7
        case "G#": return 8
        case "A": return 9
        case "A#": return 10
        case "B": return 11
        default: return 0
        }
    }

    private func installPitchTrackingIfNeeded() {
        guard !pitchTapInstalled else { return }
        let format = vocalEQ.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else { return }

        vocalEQ.installTap(
            onBus: 0,
            bufferSize: 2_048,
            format: format
        ) { [weak self] buffer, _ in
            guard let self, self.autoTuneEnabled,
                  let frequency = self.detectPitch(buffer: buffer) else { return }

            let exactMIDI = 69.0 + 12.0 * log2(frequency / 440.0)
            let targetMIDI = self.nearestAllowedMIDI(to: exactMIDI)
            let rawCents = Float((targetMIDI - exactMIDI) * 100.0)
            let humanFactor = 1.0 - (self.tuneHumanize * 0.35)
            let targetCents = rawCents * self.tuneStrength * humanFactor

            let bufferSeconds = Float(buffer.frameLength) / Float(format.sampleRate)
            let retuneSeconds = self.tuneRetuneMs / 1_000
            let alpha = min(1, max(0.08, bufferSeconds / (bufferSeconds + retuneSeconds)))
            let next = self.currentPitchCorrection + ((targetCents - self.currentPitchCorrection) * alpha)

            self.currentPitchCorrection = min(max(next, -600), 600)
            DispatchQueue.main.async {
                self.vocalPitch.pitch = self.currentPitchCorrection
            }
        }
        pitchTapInstalled = true
    }

    private func nearestAllowedMIDI(to value: Double) -> Double {
        let major = [0, 2, 4, 5, 7, 9, 11]
        let minor = [0, 2, 3, 5, 7, 8, 10]
        let intervals = tuneScale == "minor" ? minor : major
        let allowed = Set(intervals.map { ($0 + tuneKey) % 12 })

        let center = Int(value.rounded())
        var best = center
        var bestDistance = Double.greatestFiniteMagnitude

        for candidate in (center - 6)...(center + 6) {
            let pitchClass = ((candidate % 12) + 12) % 12
            guard allowed.contains(pitchClass) else { continue }
            let distance = abs(Double(candidate) - value)
            if distance < bestDistance {
                bestDistance = distance
                best = candidate
            }
        }
        return Double(best)
    }

    private func detectPitch(buffer: AVAudioPCMBuffer) -> Double? {
        guard let channel = buffer.floatChannelData?[0] else { return nil }
        let count = Int(buffer.frameLength)
        guard count > 256 else { return nil }

        var rms: Float = 0
        for i in 0..<count {
            let x = channel[i]
            rms += x * x
        }
        rms = sqrt(rms / Float(count))
        guard rms > 0.012 else { return nil }

        let sr = buffer.format.sampleRate
        let minLag = max(1, Int(sr / 1_000))
        let maxLag = min(count / 2, Int(sr / 80))
        guard maxLag > minLag else { return nil }

        var bestLag = 0
        var bestScore: Float = -1

        for lag in minLag...maxLag {
            var correlation: Float = 0
            var energyA: Float = 0
            var energyB: Float = 0
            var i = 0
            while i + lag < count {
                let a = channel[i]
                let b = channel[i + lag]
                correlation += a * b
                energyA += a * a
                energyB += b * b
                i += 2
            }
            let denom = sqrt(max(energyA * energyB, 0.000_000_1))
            let score = correlation / denom
            if score > bestScore {
                bestScore = score
                bestLag = lag
            }
        }

        guard bestLag > 0, bestScore > 0.55 else { return nil }
        let frequency = sr / Double(bestLag)
        guard frequency >= 80, frequency <= 1_000 else { return nil }
        return frequency
    }

    func prepareMicrophone() {
        requestMicrophoneAccess { [weak self] granted in
            guard let self, granted else { return }
            DispatchQueue.main.async {
                self.connectVocalGraphIfNeeded()
                self.startIfNeeded()
            }
        }
    }

    func startRecording() {
        requestMicrophoneAccess { [weak self] granted in
            guard let self, granted else { return }
            DispatchQueue.main.async {
                guard !self.isRecording else { return }
                self.connectVocalGraphIfNeeded()
                self.startIfNeeded()

                let input = self.engine.inputNode
                let recordNode: AVAudioNode = self.vocalPitch
                let format = recordNode.outputFormat(forBus: 0)
                guard format.sampleRate > 0, format.channelCount > 0 else { return }

                let directory = FileManager.default.urls(
                    for: .documentDirectory,
                    in: .userDomainMask
                ).first!
                let url = directory.appendingPathComponent(
                    "Royce-Take-\(Int(Date().timeIntervalSince1970)).caf"
                )

                do {
                    let file = try AVAudioFile(
                        forWriting: url,
                        settings: format.settings
                    )
                    self.recordingFile = file
                    self.lastRecordingURL = url

                    recordNode.installTap(
                        onBus: 0,
                        bufferSize: 1_024,
                        format: format
                    ) { [weak self] buffer, _ in
                        guard let self, self.isRecording else { return }
                        try? self.recordingFile?.write(from: buffer)
                    }

                    self.isRecording = true
                } catch {
                    print("Royce recording start error: \(error)")
                    self.recordingFile = nil
                    self.isRecording = false
                }
            }
        }
    }

    func stopRecording() {
        guard isRecording else { return }
        vocalPitch.removeTap(onBus: 0)
        isRecording = false
        recordingFile = nil
    }

    func playLastRecording() {
        guard let url = lastRecordingURL,
              let file = try? AVAudioFile(forReading: url) else { return }

        startIfNeeded()
        let player = AVAudioPlayerNode()
        engine.attach(player)
        engine.connect(
            player,
            to: engine.mainMixerNode,
            format: file.processingFormat
        )
        activePlayers.append(player)

        player.scheduleFile(file, at: nil) { [weak self, weak player] in
            guard let self, let player else { return }
            DispatchQueue.main.async {
                player.stop()
                self.engine.detach(player)
                self.activePlayers.removeAll { $0 === player }
            }
        }
        player.play()
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
                self.vocalMixer.outputVolume = enabled ? self.vocalFader * self.monitorLevel : 0
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
        monitorLevel = safeVolume
        let safeLow = min(max(lowEQ, -12), 12)
        let safeHigh = min(max(highEQ, -12), 12)
        let safeReverb = min(max(reverb, 0), 1)
        let safeDelay = min(max(delay, 0), 1)

        vocalEQ.bands[0].gain = safeLow
        vocalEQ.bands[1].gain = safeHigh
        vocalReverb.wetDryMix = safeReverb * 100
        vocalDelay.wetDryMix = safeDelay * 100

        if monitoringEnabled {
            vocalMixer.outputVolume = vocalFader * monitorLevel
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
        engine.attach(vocalPitch)
        engine.attach(vocalReverb)
        engine.attach(vocalDelay)
        engine.attach(vocalMixer)

        engine.connect(input, to: vocalEQ, format: format)
        engine.connect(vocalEQ, to: vocalPitch, format: format)
        engine.connect(vocalPitch, to: vocalReverb, format: format)
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
        engine.connect(player, to: instrumentMixer, format: format)
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
