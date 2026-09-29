import Foundation

struct RoyceMediaItem {
    let id: String
    let name: String
    let url: URL
}

final class NativeMediaStore {
    static let shared = NativeMediaStore()
    private init() {}

    private var mediaDirectory: URL {
        let docs = FileManager.default.urls(
            for: .documentDirectory,
            in: .userDomainMask
        ).first!
        let dir = docs.appendingPathComponent("RoyceMedia", isDirectory: true)
        try? FileManager.default.createDirectory(
            at: dir,
            withIntermediateDirectories: true
        )
        return dir
    }

    func importFile(from sourceURL: URL) throws -> RoyceMediaItem {
        let accessing = sourceURL.startAccessingSecurityScopedResource()
        defer {
            if accessing {
                sourceURL.stopAccessingSecurityScopedResource()
            }
        }

        let id = UUID().uuidString
        let ext = sourceURL.pathExtension.isEmpty ? "audio" : sourceURL.pathExtension
        let destination = mediaDirectory
            .appendingPathComponent(id)
            .appendingPathExtension(ext)

        if FileManager.default.fileExists(atPath: destination.path) {
            try FileManager.default.removeItem(at: destination)
        }

        try FileManager.default.copyItem(at: sourceURL, to: destination)

        let originalName = sourceURL.lastPathComponent.isEmpty
            ? "Imported Audio"
            : sourceURL.lastPathComponent

        let metadataURL = mediaDirectory
            .appendingPathComponent(id)
            .appendingPathExtension("json")

        let metadata: [String: String] = [
            "id": id,
            "name": originalName,
            "file": destination.lastPathComponent
        ]
        let data = try JSONSerialization.data(
            withJSONObject: metadata,
            options: [.prettyPrinted]
        )
        try data.write(to: metadataURL, options: .atomic)

        return RoyceMediaItem(
            id: id,
            name: originalName,
            url: destination
        )
    }

    func item(id: String) -> RoyceMediaItem? {
        let metadataURL = mediaDirectory
            .appendingPathComponent(id)
            .appendingPathExtension("json")

        guard
            let data = try? Data(contentsOf: metadataURL),
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: String],
            let name = object["name"],
            let file = object["file"]
        else { return nil }

        let url = mediaDirectory.appendingPathComponent(file)
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }

        return RoyceMediaItem(id: id, name: name, url: url)
    }
}
