import SwiftUI

struct ContentView: View {
    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            RoyceWebView()
                .ignoresSafeArea(.container, edges: .bottom)
        }
        .onAppear {
            AudioSessionManager.shared.configure()
        }
    }
}
