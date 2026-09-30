import SwiftUI
import WebKit
import AVFoundation
import UniformTypeIdentifiers

struct RoyceWebView: UIViewRepresentable {
    private let fallbackStudioURL = URL(string: "https://royce-studio-psi.vercel.app/?native=ios")!

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.websiteDataStore = .default()

        configuration.userContentController.add(context.coordinator, name: "royceAudio")
        let bridge = WKUserScript(
            source: """
            window.royceNativeAudio = {
              drum: function(name) {
                window.webkit.messageHandlers.royceAudio.postMessage({type:'drum', name:name});
              },
              tone: function(frequency, waveform, duration, gain) {
                window.webkit.messageHandlers.royceAudio.postMessage({
                  type:'tone',
                  frequency:frequency,
                  waveform:waveform || 'sine',
                  duration:duration || 0.55,
                  gain:gain || 0.16
                });
              },
              monitor: function(enabled) {
                window.webkit.messageHandlers.royceAudio.postMessage({
                  type:'monitor',
                  enabled:!!enabled
                });
              },
              vocalFX: function(volume, lowEQ, highEQ, reverb, delay) {
                window.webkit.messageHandlers.royceAudio.postMessage({
                  type:'vocalFX',
                  volume:volume,
                  lowEQ:lowEQ,
                  highEQ:highEQ,
                  reverb:reverb,
                  delay:delay
                });
              },
              prepareMic: function() {
                window.webkit.messageHandlers.royceAudio.postMessage({type:'prepareMic'});
              },
              recordStart: function() {
                window.webkit.messageHandlers.royceAudio.postMessage({type:'recordStart'});
              },
              recordStop: function() {
                window.webkit.messageHandlers.royceAudio.postMessage({type:'recordStop'});
              },
              playLastTake: function() {
                window.webkit.messageHandlers.royceAudio.postMessage({type:'playLastTake'});
              },
              shareLastTake: function() {
                window.webkit.messageHandlers.royceAudio.postMessage({type:'shareLastTake'});
              },
              listTakes: function() {
                window.webkit.messageHandlers.royceAudio.postMessage({type:'listTakes'});
              },
              playTake: function(id) {
                window.webkit.messageHandlers.royceAudio.postMessage({
                  type:'playTake',
                  id:id
                });
              },
              shareTake: function(id) {
                window.webkit.messageHandlers.royceAudio.postMessage({
                  type:'shareTake',
                  id:id
                });
              },
              deleteTake: function(id) {
                window.webkit.messageHandlers.royceAudio.postMessage({
                  type:'deleteTake',
                  id:id
                });
              },
              loadCompTake: function(id) {
                window.webkit.messageHandlers.royceAudio.postMessage({
                  type:'loadCompTake',
                  id:id
                });
              },
              compPlay: function() {
                window.webkit.messageHandlers.royceAudio.postMessage({type:'compPlay'});
              },
              compToggle: function() {
                window.webkit.messageHandlers.royceAudio.postMessage({type:'compToggle'});
              },
              compStop: function() {
                window.webkit.messageHandlers.royceAudio.postMessage({type:'compStop'});
              },
              transportStart: function(bpm, tracks, compStartBar, lengthBars, startBar, startBeat, startSixteenth) {
                window.webkit.messageHandlers.royceAudio.postMessage({
                  type:'transportStart',
                  bpm:bpm,
                  tracks:tracks,
                  compStartBar:compStartBar,
                  lengthBars:lengthBars || 32,
                  startBar:startBar || 1,
                  startBeat:startBeat || 1,
                  startSixteenth:startSixteenth || 1
                });
              },
              transportStop: function() {
                window.webkit.messageHandlers.royceAudio.postMessage({type:'transportStop'});
              },
              transportClipVolume: function(clipId, volume) {
                window.webkit.messageHandlers.royceAudio.postMessage({
                  type:'transportClipVolume',
                  clipId:clipId,
                  volume:volume
                });
              },
              transportClipPan: function(clipId, pan) {
                window.webkit.messageHandlers.royceAudio.postMessage({
                  type:'transportClipPan',
                  clipId:clipId,
                  pan:pan
                });
              },
              autoTune: function(enabled, key, scale, strength, retuneMs, humanize) {
                window.webkit.messageHandlers.royceAudio.postMessage({
                  type:'autoTune',
                  enabled:!!enabled,
                  key:key || 'C',
                  scale:scale || 'major',
                  strength:strength,
                  retuneMs:retuneMs,
                  humanize:humanize
                });
              },
              saveProject: function(name, json) {
                window.webkit.messageHandlers.royceAudio.postMessage({
                  type:'saveProject',
                  name:name || 'Untitled Royce Session',
                  json:json
                });
              },
              loadLastProject: function() {
                window.webkit.messageHandlers.royceAudio.postMessage({type:'loadLastProject'});
              },
              listProjects: function() {
                window.webkit.messageHandlers.royceAudio.postMessage({type:'listProjects'});
              },
              loadProject: function(name) {
                window.webkit.messageHandlers.royceAudio.postMessage({
                  type:'loadProject',
                  name:name
                });
              },
              shareProject: function(name) {
                window.webkit.messageHandlers.royceAudio.postMessage({
                  type:'shareProject',
                  name:name
                });
              },
              saveRecovery: function(json) {
                window.webkit.messageHandlers.royceAudio.postMessage({
                  type:'saveRecovery',
                  json:json
                });
              },
              loadRecovery: function() {
                window.webkit.messageHandlers.royceAudio.postMessage({type:'loadRecovery'});
              },
              clearRecovery: function() {
                window.webkit.messageHandlers.royceAudio.postMessage({type:'clearRecovery'});
              },
              masterStart: function() {
                window.webkit.messageHandlers.royceAudio.postMessage({type:'masterStart'});
              },
              masterStop: function() {
                window.webkit.messageHandlers.royceAudio.postMessage({type:'masterStop'});
              },
              masterPlay: function() {
                window.webkit.messageHandlers.royceAudio.postMessage({type:'masterPlay'});
              },
              masterShare: function() {
                window.webkit.messageHandlers.royceAudio.postMessage({type:'masterShare'});
              },
              importMedia: function() {
                window.webkit.messageHandlers.royceAudio.postMessage({type:'importMedia'});
              },
              importDeck: function(deck) {
                window.webkit.messageHandlers.royceAudio.postMessage({
                  type:'importDeck',
                  deck:deck
                });
              },
              loadDeckMedia: function(deck, id) {
                window.webkit.messageHandlers.royceAudio.postMessage({
                  type:'loadDeckMedia',
                  deck:deck,
                  id:id
                });
              },
              deckToggle: function(deck) {
                window.webkit.messageHandlers.royceAudio.postMessage({
                  type:'deckToggle',
                  deck:deck
                });
              },
              deckCue: function(deck) {
                window.webkit.messageHandlers.royceAudio.postMessage({
                  type:'deckCue',
                  deck:deck
                });
              },
              deckPitch: function(deck, semitones) {
                window.webkit.messageHandlers.royceAudio.postMessage({
                  type:'deckPitch',
                  deck:deck,
                  semitones:semitones
                });
              },
              deckFilter: function(deck, frequency) {
                window.webkit.messageHandlers.royceAudio.postMessage({
                  type:'deckFilter',
                  deck:deck,
                  frequency:frequency
                });
              },
              deckCrossfader: function(value) {
                window.webkit.messageHandlers.royceAudio.postMessage({
                  type:'deckCrossfader',
                  value:value
                });
              },
              mediaToggle: function(id, volume, loop) {
                window.webkit.messageHandlers.royceAudio.postMessage({
                  type:'mediaToggle', id:id, volume:volume, loop:!!loop
                });
              },
              mediaStop: function(id) {
                window.webkit.messageHandlers.royceAudio.postMessage({
                  type:'mediaStop', id:id
                });
              },
              mediaVolume: function(id, volume) {
                window.webkit.messageHandlers.royceAudio.postMessage({
                  type:'mediaVolume', id:id, volume:volume
                });
              },
              mediaLoop: function(id, loop) {
                window.webkit.messageHandlers.royceAudio.postMessage({
                  type:'mediaLoop', id:id, loop:!!loop
                });
              },
              mixer: function(values) {
                window.webkit.messageHandlers.royceAudio.postMessage({
                  type:'mixer',
                  values:values || {}
                });
              },
              metronomeStart: function(bpm) {
                window.webkit.messageHandlers.royceAudio.postMessage({
                  type:'metronomeStart',
                  bpm:bpm
                });
              },
              metronomeStop: function() {
                window.webkit.messageHandlers.royceAudio.postMessage({
                  type:'metronomeStop'
                });
              },
              metronomeVolume: function(value) {
                window.webkit.messageHandlers.royceAudio.postMessage({
                  type:'metronomeVolume',
                  value:value
                });
              }
            };
            """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        configuration.userContentController.addUserScript(bridge)

        let preferences = WKWebpagePreferences()
        preferences.allowsContentJavaScript = true
        configuration.defaultWebpagePreferences = preferences

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.keyboardDismissMode = .interactive
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black

        if let localURL = Bundle.main.url(
            forResource: "index",
            withExtension: "html",
            subdirectory: "Web"
        ) {
            webView.loadFileURL(
                localURL,
                allowingReadAccessTo: localURL.deletingLastPathComponent()
            )
        } else {
            let request = URLRequest(
                url: fallbackStudioURL,
                cachePolicy: .reloadIgnoringLocalAndRemoteCacheData,
                timeoutInterval: 30
            )
            webView.load(request)
        }
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, UIDocumentPickerDelegate {
        weak var hostWebView: WKWebView?
        var pendingImportTarget = "timeline"

        func webView(
            _ webView: WKWebView,
            didFinish navigation: WKNavigation!
        ) {
            AudioSessionManager.shared.configure()
            NativeAudioEngine.shared.startIfNeeded()
        }

        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            guard message.name == "royceAudio",
                  let body = message.body as? [String: Any],
                  let type = body["type"] as? String else { return }

            switch type {
            case "drum":
                if let name = body["name"] as? String {
                    NativeAudioEngine.shared.playDrum(name)
                }
            case "tone":
                let frequency = body["frequency"] as? Double ?? 440
                let waveform = body["waveform"] as? String ?? "sine"
                let duration = body["duration"] as? Double ?? 0.55
                let gain = body["gain"] as? Double ?? 0.16
                NativeAudioEngine.shared.playTone(
                    frequency: frequency,
                    waveform: waveform,
                    duration: duration,
                    gain: gain
                )
            case "monitor":
                let enabled = body["enabled"] as? Bool ?? false
                NativeAudioEngine.shared.setMonitoring(enabled)
            case "vocalFX":
                let volume = body["volume"] as? Double ?? 0.85
                let lowEQ = body["lowEQ"] as? Double ?? 0
                let highEQ = body["highEQ"] as? Double ?? 0
                let reverb = body["reverb"] as? Double ?? 0.12
                let delay = body["delay"] as? Double ?? 0.10
                NativeAudioEngine.shared.setVocalFX(
                    volume: Float(volume),
                    lowEQ: Float(lowEQ),
                    highEQ: Float(highEQ),
                    reverb: Float(reverb),
                    delay: Float(delay)
                )
            case "prepareMic":
                NativeAudioEngine.shared.prepareMicrophone()
            case "recordStart":
                NativeAudioEngine.shared.startRecording()
            case "recordStop":
                NativeAudioEngine.shared.stopRecording()
            case "playLastTake":
                NativeAudioEngine.shared.playLastRecording()
            case "shareLastTake":
                guard let webView = message.webView else { return }
                shareGeneratedFile(
                    from: webView,
                    generator: {
                        NativeAudioEngine.shared.exportLastTakeWAV()
                    },
                    failureJavaScript: "window.royceWAVExportFailed && window.royceWAVExportFailed('take')"
                )
            case "listTakes":
                let items = NativeAudioEngine.shared.takeLibrary()
                if let data = try? JSONSerialization.data(withJSONObject: items),
                   let json = String(data: data, encoding: .utf8) {
                    message.webView?.evaluateJavaScript(
                        "window.royceReceiveTakeLibrary && window.royceReceiveTakeLibrary(\(json))"
                    )
                }
            case "playTake":
                if let id = body["id"] as? String {
                    NativeAudioEngine.shared.playTake(id: id)
                }
            case "shareTake":
                guard let id = body["id"] as? String,
                      let webView = message.webView else { return }
                shareGeneratedFile(
                    from: webView,
                    generator: {
                        NativeAudioEngine.shared.exportTakeWAV(id: id)
                    },
                    failureJavaScript: "window.royceWAVExportFailed && window.royceWAVExportFailed('take')"
                )
            case "deleteTake":
                if let id = body["id"] as? String {
                    _ = NativeAudioEngine.shared.deleteTake(id: id)
                    let items = NativeAudioEngine.shared.takeLibrary()
                    if let data = try? JSONSerialization.data(withJSONObject: items),
                       let json = String(data: data, encoding: .utf8) {
                        message.webView?.evaluateJavaScript(
                            "window.royceReceiveTakeLibrary && window.royceReceiveTakeLibrary(\(json))"
                        )
                    }
                }
            case "loadCompTake":
                if let id = body["id"] as? String {
                    let loaded = NativeAudioEngine.shared.loadCompTake(id: id)
                    let safeID = id.replacingOccurrences(of: "'", with: "\\'")
                    message.webView?.evaluateJavaScript(
                        "window.royceCompTakeLoaded && window.royceCompTakeLoaded('\(safeID)', \(loaded ? "true" : "false"))"
                    )
                }
            case "compPlay":
                NativeAudioEngine.shared.playCompTake()
            case "compToggle":
                NativeAudioEngine.shared.toggleCompTake()
            case "compStop":
                NativeAudioEngine.shared.stopCompTake()
            case "transportStart":
                let bpm = body["bpm"] as? Double ?? 120
                let requested = body["tracks"] as? [[String: Any]] ?? []
                let compStartBar = body["compStartBar"] as? Int
                let lengthBars = body["lengthBars"] as? Int ?? 32
                let startBar = body["startBar"] as? Int ?? 1
                let startBeat = body["startBeat"] as? Int ?? 1
                let startSixteenth = body["startSixteenth"] as? Int ?? 1
                var nativeTracks: [[String: Any]] = []

                for item in requested {
                    guard
                        let id = item["id"] as? String,
                        let media = NativeMediaStore.shared.item(id: id)
                    else { continue }

                    nativeTracks.append([
                        "clipId": item["clipId"] as? String ?? UUID().uuidString,
                        "url": media.url.absoluteString,
                        "bar": item["bar"] as? Int ?? 1,
                        "beat": item["beat"] as? Int ?? 1,
                        "sixteenth": item["sixteenth"] as? Int ?? 1,
                        "volume": Float(item["volume"] as? Double ?? 1),
                        "pan": Float(item["pan"] as? Double ?? 0),
                        "loop": item["loop"] as? Bool ?? false,
                        "trimStart": item["trimStart"] as? Double ?? 0,
                        "trimEnd": item["trimEnd"] as? Double ?? 0
                    ])
                }

                let started = NativeAudioEngine.shared.startNativeTransport(
                    bpm: bpm,
                    tracks: nativeTracks,
                    compStartBar: compStartBar,
                    lengthBars: lengthBars,
                    startBar: startBar,
                    startBeat: startBeat,
                    startSixteenth: startSixteenth
                )
                message.webView?.evaluateJavaScript(
                    "window.royceNativeTransportStarted && window.royceNativeTransportStarted(\(started ? "true" : "false"))"
                )
            case "transportStop":
                NativeAudioEngine.shared.stopNativeTransport()
            case "transportClipVolume":
                if let clipID = body["clipId"] as? String {
                    let volume = body["volume"] as? Double ?? 1
                    NativeAudioEngine.shared.setTransportClipVolume(
                        id: clipID,
                        volume: Float(volume)
                    )
                }
            case "transportClipPan":
                if let clipID = body["clipId"] as? String {
                    let pan = body["pan"] as? Double ?? 0
                    NativeAudioEngine.shared.setTransportClipPan(
                        id: clipID,
                        pan: Float(pan)
                    )
                }
            case "autoTune":
                let enabled = body["enabled"] as? Bool ?? false
                let key = body["key"] as? String ?? "C"
                let scale = body["scale"] as? String ?? "major"
                let strength = body["strength"] as? Double ?? 0.70
                let retuneMs = body["retuneMs"] as? Double ?? 35
                let humanize = body["humanize"] as? Double ?? 0.20
                NativeAudioEngine.shared.setAutoTune(
                    enabled: enabled,
                    key: key,
                    scale: scale,
                    strength: Float(strength),
                    retuneMs: Float(retuneMs),
                    humanize: Float(humanize)
                )
            case "saveProject":
                let name = body["name"] as? String ?? "Untitled Royce Session"
                let json = body["json"] as? String ?? "{}"
                do {
                    _ = try NativeProjectStore.shared.save(name: name, json: json)
                    message.webView?.evaluateJavaScript(
                        "window.royceNativeProjectSaved && window.royceNativeProjectSaved()"
                    )
                } catch {
                    message.webView?.evaluateJavaScript(
                        "window.royceNativeProjectError && window.royceNativeProjectError('Save failed')"
                    )
                }
            case "loadLastProject":
                if let json = NativeProjectStore.shared.loadLast() {
                    message.webView?.evaluateJavaScript(
                        "window.royceApplyNativeProject && window.royceApplyNativeProject(\(json))"
                    )
                }
            case "listProjects":
                let names = NativeProjectStore.shared.listProjects()
                if let data = try? JSONSerialization.data(withJSONObject: names),
                   let json = String(data: data, encoding: .utf8) {
                    message.webView?.evaluateJavaScript(
                        "window.royceReceiveProjectList && window.royceReceiveProjectList(\(json))"
                    )
                }
            case "loadProject":
                if let name = body["name"] as? String,
                   let json = NativeProjectStore.shared.load(named: name) {
                    message.webView?.evaluateJavaScript(
                        "window.royceApplyNativeProject && window.royceApplyNativeProject(\(json))"
                    )
                }
            case "shareProject":
                guard let name = body["name"] as? String,
                      let url = NativeProjectStore.shared.url(named: name),
                      let webView = message.webView else { return }
                let controller = UIActivityViewController(
                    activityItems: [url],
                    applicationActivities: nil
                )
                topViewController(from: webView.window?.rootViewController)?
                    .present(controller, animated: true)
            case "saveRecovery":
                let json = body["json"] as? String ?? "{}"
                NativeProjectStore.shared.saveRecovery(json: json)
            case "loadRecovery":
                if let json = NativeProjectStore.shared.loadRecovery() {
                    message.webView?.evaluateJavaScript(
                        "window.royceApplyRecovery && window.royceApplyRecovery(\(json))"
                    )
                } else {
                    message.webView?.evaluateJavaScript(
                        "window.royceNoRecovery && window.royceNoRecovery()"
                    )
                }
            case "clearRecovery":
                NativeProjectStore.shared.clearRecovery()
            case "masterStart":
                NativeAudioEngine.shared.startMasterCapture()
            case "masterStop":
                NativeAudioEngine.shared.stopMasterCapture()
            case "masterPlay":
                NativeAudioEngine.shared.playLastMasterCapture()
            case "masterShare":
                guard let webView = message.webView else { return }
                shareGeneratedFile(
                    from: webView,
                    generator: {
                        NativeAudioEngine.shared.exportLastMasterWAV()
                    },
                    failureJavaScript: "window.royceWAVExportFailed && window.royceWAVExportFailed('master')"
                )
            case "importMedia":
                guard let webView = message.webView else { return }
                hostWebView = webView
                pendingImportTarget = "timeline"
                let picker = UIDocumentPickerViewController(
                    forOpeningContentTypes: [.audio],
                    asCopy: true
                )
                picker.delegate = self
                picker.allowsMultipleSelection = true
                topViewController(from: webView.window?.rootViewController)?
                    .present(picker, animated: true)
            case "importDeck":
                guard let webView = message.webView else { return }
                let deck = (body["deck"] as? String ?? "A").uppercased()
                hostWebView = webView
                pendingImportTarget = deck == "B" ? "deckB" : "deckA"
                let picker = UIDocumentPickerViewController(
                    forOpeningContentTypes: [.audio],
                    asCopy: true
                )
                picker.delegate = self
                picker.allowsMultipleSelection = false
                topViewController(from: webView.window?.rootViewController)?
                    .present(picker, animated: true)
            case "loadDeckMedia":
                let deck = (body["deck"] as? String ?? "A").uppercased()
                guard
                    let id = body["id"] as? String,
                    let item = NativeMediaStore.shared.item(id: id)
                else { return }
                if NativeAudioEngine.shared.loadDeck(deck: deck, url: item.url) {
                    let payload: [String: String] = [
                        "id": item.id,
                        "name": item.name
                    ]
                    if let data = try? JSONSerialization.data(withJSONObject: payload),
                       let json = String(data: data, encoding: .utf8) {
                        message.webView?.evaluateJavaScript(
                            "window.royceNativeDeckImported && window.royceNativeDeckImported('\(deck)', \(json))"
                        )
                    }
                }
            case "deckToggle":
                let deck = body["deck"] as? String ?? "A"
                NativeAudioEngine.shared.toggleDeck(deck)
            case "deckCue":
                let deck = body["deck"] as? String ?? "A"
                NativeAudioEngine.shared.cueDeck(deck)
            case "deckPitch":
                let deck = body["deck"] as? String ?? "A"
                let semitones = Float(body["semitones"] as? Double ?? 0)
                NativeAudioEngine.shared.setDeckPitch(deck, semitones: semitones)
            case "deckFilter":
                let deck = body["deck"] as? String ?? "A"
                let frequency = Float(body["frequency"] as? Double ?? 12_000)
                NativeAudioEngine.shared.setDeckFilter(deck, frequency: frequency)
            case "deckCrossfader":
                let value = Float(body["value"] as? Double ?? 0)
                NativeAudioEngine.shared.setCrossfader(value)
            case "mediaToggle":
                guard
                    let id = body["id"] as? String,
                    let item = NativeMediaStore.shared.item(id: id)
                else { return }
                let volume = Float(body["volume"] as? Double ?? 1)
                let loop = body["loop"] as? Bool ?? false
                NativeAudioEngine.shared.toggleMedia(
                    id: id,
                    url: item.url,
                    volume: volume,
                    loop: loop
                )
            case "mediaStop":
                if let id = body["id"] as? String {
                    NativeAudioEngine.shared.stopMedia(id: id)
                }
            case "mediaVolume":
                if let id = body["id"] as? String {
                    let volume = Float(body["volume"] as? Double ?? 1)
                    NativeAudioEngine.shared.setMediaVolume(
                        id: id,
                        volume: volume
                    )
                }
            case "mediaLoop":
                if let id = body["id"] as? String {
                    let loop = body["loop"] as? Bool ?? false
                    NativeAudioEngine.shared.setMediaLoop(id: id, loop: loop)
                }
            case "mixer":
                let values = body["values"] as? [String: Any] ?? [:]
                NativeAudioEngine.shared.setMixer(
                    instrumentVolume: Float(values["instrumentVolume"] as? Double ?? 0.8),
                    instrumentPan: Float(values["instrumentPan"] as? Double ?? 0),
                    instrumentLowEQ: Float(values["instrumentLowEQ"] as? Double ?? 0),
                    instrumentHighEQ: Float(values["instrumentHighEQ"] as? Double ?? 0),
                    vocalVolume: Float(values["vocalVolume"] as? Double ?? 0.85),
                    vocalPan: Float(values["vocalPan"] as? Double ?? 0),
                    masterVolume: Float(values["masterVolume"] as? Double ?? 0.9),
                    compression: Float(values["compression"] as? Double ?? 0.2),
                    limiterCeiling: Float(values["limiterCeiling"] as? Double ?? -1)
                )
            case "metronomeStart":
                let bpm = body["bpm"] as? Double ?? 120
                NativeAudioEngine.shared.startMetronome(bpm: bpm)
            case "metronomeStop":
                NativeAudioEngine.shared.stopMetronome()
            case "metronomeVolume":
                let value = Float(body["value"] as? Double ?? 0.22)
                NativeAudioEngine.shared.setMetronomeVolume(value)
            default:
                break
            }
        }

        func documentPicker(
            _ controller: UIDocumentPickerViewController,
            didPickDocumentsAt urls: [URL]
        ) {
            if pendingImportTarget == "deckA" || pendingImportTarget == "deckB" {
                guard
                    let url = urls.first,
                    let item = try? NativeMediaStore.shared.importFile(from: url)
                else { return }

                let deck = pendingImportTarget == "deckB" ? "B" : "A"
                _ = NativeAudioEngine.shared.loadDeck(deck: deck, url: item.url)

                let payload: [String: String] = [
                    "id": item.id,
                    "name": item.name
                ]
                guard
                    let data = try? JSONSerialization.data(withJSONObject: payload),
                    let json = String(data: data, encoding: .utf8)
                else { return }

                hostWebView?.evaluateJavaScript(
                    "window.royceNativeDeckImported && window.royceNativeDeckImported('\(deck)', \(json))"
                )
                pendingImportTarget = "timeline"
                return
            }

            var imported: [[String: String]] = []

            for url in urls {
                if let item = try? NativeMediaStore.shared.importFile(from: url) {
                    imported.append([
                        "id": item.id,
                        "name": item.name
                    ])
                }
            }

            guard
                let data = try? JSONSerialization.data(withJSONObject: imported),
                let json = String(data: data, encoding: .utf8)
            else { return }

            hostWebView?.evaluateJavaScript(
                "window.royceNativeMediaImported && window.royceNativeMediaImported(\(json))"
            )
        }

        func documentPickerWasCancelled(
            _ controller: UIDocumentPickerViewController
        ) {
            if pendingImportTarget == "deckA" || pendingImportTarget == "deckB" {
                hostWebView?.evaluateJavaScript(
                    "window.royceNativeDeckImportCancelled && window.royceNativeDeckImportCancelled()"
                )
            } else {
                hostWebView?.evaluateJavaScript(
                    "window.royceNativeMediaImportCancelled && window.royceNativeMediaImportCancelled()"
                )
            }
            pendingImportTarget = "timeline"
        }

        private func shareGeneratedFile(
            from webView: WKWebView,
            generator: @escaping () -> URL?,
            failureJavaScript: String
        ) {
            DispatchQueue.global(qos: .userInitiated).async { [weak self, weak webView] in
                let url = generator()

                DispatchQueue.main.async {
                    guard let self, let webView else { return }

                    guard let url else {
                        webView.evaluateJavaScript(failureJavaScript)
                        return
                    }

                    let controller = UIActivityViewController(
                        activityItems: [url],
                        applicationActivities: nil
                    )
                    self.topViewController(
                        from: webView.window?.rootViewController
                    )?.present(controller, animated: true)
                }
            }
        }

        private func topViewController(
            from root: UIViewController?
        ) -> UIViewController? {
            if let presented = root?.presentedViewController {
                return topViewController(from: presented)
            }
            if let navigation = root as? UINavigationController {
                return topViewController(from: navigation.visibleViewController)
            }
            if let tab = root as? UITabBarController {
                return topViewController(from: tab.selectedViewController)
            }
            return root
        }

        @available(iOS 15.0, *)
        func webView(
            _ webView: WKWebView,
            requestMediaCapturePermissionFor origin: WKSecurityOrigin,
            initiatedByFrame frame: WKFrameInfo,
            type: WKMediaCaptureType,
            decisionHandler: @escaping (WKPermissionDecision) -> Void
        ) {
            switch type {
            case .microphone, .cameraAndMicrophone:
                decisionHandler(.grant)
            default:
                decisionHandler(.prompt)
            }
        }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            webView.reload()
        }
    }
}
