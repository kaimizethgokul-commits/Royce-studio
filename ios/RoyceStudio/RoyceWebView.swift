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
                guard let url = NativeAudioEngine.shared.lastTakeURL,
                      let webView = message.webView else { return }
                let controller = UIActivityViewController(
                    activityItems: [url],
                    applicationActivities: nil
                )
                topViewController(from: webView.window?.rootViewController)?
                    .present(controller, animated: true)
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
            case "masterStart":
                NativeAudioEngine.shared.startMasterCapture()
            case "masterStop":
                NativeAudioEngine.shared.stopMasterCapture()
            case "masterPlay":
                NativeAudioEngine.shared.playLastMasterCapture()
            case "masterShare":
                guard let url = NativeAudioEngine.shared.lastMasterCaptureURL,
                      let webView = message.webView else { return }
                let controller = UIActivityViewController(
                    activityItems: [url],
                    applicationActivities: nil
                )
                topViewController(from: webView.window?.rootViewController)?
                    .present(controller, animated: true)
            case "importMedia":
                guard let webView = message.webView else { return }
                hostWebView = webView
                let picker = UIDocumentPickerViewController(
                    forOpeningContentTypes: [.audio],
                    asCopy: true
                )
                picker.delegate = self
                picker.allowsMultipleSelection = true
                topViewController(from: webView.window?.rootViewController)?
                    .present(picker, animated: true)
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
            default:
                break
            }
        }

        func documentPicker(
            _ controller: UIDocumentPickerViewController,
            didPickDocumentsAt urls: [URL]
        ) {
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
            hostWebView?.evaluateJavaScript(
                "window.royceNativeMediaImportCancelled && window.royceNativeMediaImportCancelled()"
            )
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
