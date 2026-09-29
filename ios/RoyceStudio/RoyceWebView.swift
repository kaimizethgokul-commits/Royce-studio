import SwiftUI
import WebKit
import AVFoundation

struct RoyceWebView: UIViewRepresentable {
    private let studioURL = URL(string: "https://royce-studio-psi.vercel.app/?native=ios")!

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

        let request = URLRequest(
            url: studioURL,
            cachePolicy: .reloadIgnoringLocalAndRemoteCacheData,
            timeoutInterval: 30
        )
        webView.load(request)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
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
            default:
                break
            }
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
