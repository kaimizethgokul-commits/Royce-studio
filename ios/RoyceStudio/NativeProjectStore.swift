import Foundation

final class NativeProjectStore {
    static let shared = NativeProjectStore()
    private init() {}

    private var recoveryURL: URL {
        let docs = FileManager.default.urls(
            for: .documentDirectory,
            in: .userDomainMask
        ).first!
        return docs.appendingPathComponent("Royce-Recovery.royce.json")
    }

    private var projectsDirectory: URL {
        let docs = FileManager.default.urls(
            for: .documentDirectory,
            in: .userDomainMask
        ).first!
        let dir = docs.appendingPathComponent("RoyceProjects", isDirectory: true)
        try? FileManager.default.createDirectory(
            at: dir,
            withIntermediateDirectories: true
        )
        return dir
    }

    private func safeName(_ name: String) -> String {
        let cleaned = name
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(
                of: "[^A-Za-z0-9 _-]",
                with: "",
                options: .regularExpression
            )
        return cleaned.isEmpty ? "Untitled Royce Session" : String(cleaned.prefix(80))
    }

    func save(name: String, json: String) throws -> URL {
        let finalName = safeName(name)
        let url = projectsDirectory
            .appendingPathComponent(finalName)
            .appendingPathExtension("royce.json")
        try json.data(using: .utf8)?.write(to: url, options: .atomic)
        UserDefaults.standard.set(url.path, forKey: "RoyceLastProjectPath")
        return url
    }

    func saveRecovery(json: String) {
        guard let data = json.data(using: .utf8) else { return }
        try? data.write(to: recoveryURL, options: .atomic)
    }

    func loadRecovery() -> String? {
        guard
            FileManager.default.fileExists(atPath: recoveryURL.path),
            let data = try? Data(contentsOf: recoveryURL)
        else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func clearRecovery() {
        try? FileManager.default.removeItem(at: recoveryURL)
    }

    func loadLast() -> String? {
        guard
            let path = UserDefaults.standard.string(forKey: "RoyceLastProjectPath"),
            FileManager.default.fileExists(atPath: path),
            let data = try? Data(contentsOf: URL(fileURLWithPath: path))
        else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func listProjects() -> [String] {
        let urls = (try? FileManager.default.contentsOfDirectory(
            at: projectsDirectory,
            includingPropertiesForKeys: [.contentModificationDateKey],
            options: [.skipsHiddenFiles]
        )) ?? []

        return urls
            .filter { $0.pathExtension == "json" && $0.lastPathComponent.hasSuffix(".royce.json") }
            .sorted {
                let left = (try? $0.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
                let right = (try? $1.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
                return left > right
            }
            .map { $0.deletingPathExtension().deletingPathExtension().lastPathComponent }
    }

    func load(named name: String) -> String? {
        let finalName = safeName(name)
        let url = projectsDirectory
            .appendingPathComponent(finalName)
            .appendingPathExtension("royce.json")
        guard let data = try? Data(contentsOf: url) else { return nil }
        UserDefaults.standard.set(url.path, forKey: "RoyceLastProjectPath")
        return String(data: data, encoding: .utf8)
    }

    func url(named name: String) -> URL? {
        let finalName = safeName(name)
        let url = projectsDirectory
            .appendingPathComponent(finalName)
            .appendingPathExtension("royce.json")
        return FileManager.default.fileExists(atPath: url.path) ? url : nil
    }
}
