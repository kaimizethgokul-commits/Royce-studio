import SwiftUI

@main
struct RoyceStudioApp: App {
    init() {
        AudioSessionManager.shared.configure()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.dark)
        }
    }
}
