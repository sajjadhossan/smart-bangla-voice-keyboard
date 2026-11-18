import AppKit

/// Floating, draggable, focus-preserving voice panel. It is a panel (not a
/// window) so accepting text does not pull focus from the current text field.
final class VoicePanel: NSPanel {
    private let stateLabel = NSTextField(labelWithString: VoiceState.idle.label)
    private let previewLabel = NSTextField(labelWithString: "")
    private let acceptButton = NSButton(title: "Insert", target: nil, action: nil)
    private let cancelButton = NSButton(title: "Discard", target: nil, action: nil)

    var onAccept: ((String) -> Void)?
    var onCancel: (() -> Void)?

    private var pendingText = ""

    override init(contentRect: NSRect, styleMask style: NSWindow.StyleMask,
                  backing bufferingType: NSWindow.BackingStoreType, defer flag: Bool) {
        super.init(contentRect: contentRect,
                   styleMask: [.borderless, .nonactivatingPanel],
                   backing: .buffered, defer: false)
        isFloatingPanel = true
        level = .floating
        hidesOnDeactivate = false
        becomesKeyOnlyIfNeeded = true
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        isMovableByWindowBackground = true

        stateLabel.frame = NSRect(x: 16, y: 112, width: 340, height: 24)
        previewLabel.frame = NSRect(x: 16, y: 58, width: 340, height: 46)
        previewLabel.lineBreakMode = .byWordWrapping
        previewLabel.maximumNumberOfLines = 2
        acceptButton.frame = NSRect(x: 210, y: 14, width: 80, height: 28)
        cancelButton.frame = NSRect(x: 296, y: 14, width: 80, height: 28)
        acceptButton.bezelStyle = .rounded
        cancelButton.bezelStyle = .rounded
        acceptButton.target = self
        acceptButton.action = #selector(accept(_:))
        cancelButton.target = self
        cancelButton.action = #selector(cancel(_:))

        contentView?.addSubview(stateLabel)
        contentView?.addSubview(previewLabel)
        contentView?.addSubview(acceptButton)
        contentView?.addSubview(cancelButton)
    }

    func setState(_ state: VoiceState) {
        stateLabel.stringValue = state.label
    }

    /// Show a preview only; nothing is inserted until the user taps Insert.
    func showPreview(_ text: String) {
        pendingText = text
        previewLabel.stringValue = text
        setState(.resultReady)
    }

    @objc private func accept(_ sender: Any?) {
        guard !pendingText.isEmpty else { return }
        setState(.inserting)
        let text = pendingText
        pendingText = ""
        previewLabel.stringValue = ""
        onAccept?(text)
        setState(.completed)
    }

    @objc private func cancel(_ sender: Any?) {
        pendingText = ""
        previewLabel.stringValue = ""
        setState(.cancelled)
        onCancel?()
    }
}
