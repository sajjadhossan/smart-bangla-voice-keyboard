import AppKit
import InputMethodKit

/// Real InputMethodKit input controller installed system-wide by macOS.
/// Offline candidate replacement and consent-gated voice both insert through
/// the active IMK client — no synthetic keystrokes, no focus theft.
@objc(SmartBanglaInputController)
final class SmartBanglaInputController: IMKInputController {
    private let panel: VoicePanel = {
        let panel = VoicePanel(
            contentRect: NSRect(x: 120, y: 120, width: 380, height: 160),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered, defer: false)
        return panel
    }()
    private let speech = SpeechCapture()
    private var composing = ""
    private var candidatesWindow: IMKCandidates?

    override func activateServer(_ sender: Any!) {
        super.activateServer(sender)
        candidatesWindow = IMKCandidates(server: server(), panelType: kIMKSingleColumnScrollingCandidatePanel)
        candidatesWindow?.setSelectionMode(kIMKSelectionByMouse)

        panel.onAccept = { [weak self] text in
            self?.insert(text)
        }
        panel.onCancel = { [weak self] in
            self?.speech.stop()
            self?.panel.orderOut(nil)
        }
        speech.onFinal = { [weak self] text in
            // Preview only — insertion needs an explicit Insert tap.
            self?.panel.showPreview(text)
        }
        speech.onError = { [weak self] in
            self?.panel.setState(.error)
        }
    }

    override func deactivateServer(_ sender: Any!) {
        speech.stop()
        panel.orderOut(nil)
        super.deactivateServer(sender)
    }

    /// Offline dictionary candidates for the current composing string.
    override func candidates(_ sender: Any!) -> [Any]! {
        let token = composing.lowercased()
        guard !token.isEmpty else { return [] }
        let dictionary: [String: String] = [
            "ami": "আমি", "amar": "আমার", "achi": "আছি",
            "bhalo": "ভালো", "valo": "ভালো", "rahim": "রহিম",
        ]
        return dictionary.filter { $0.key.hasPrefix(token) }
            .map { NSAttributedString(string: $0.value) }
    }

    override func candidateSelected(_ candidateString: NSAttributedString!) {
        insert(candidateString.string)
        composing = ""
    }

    override func handle(_ event: NSEvent!, client sender: Any!) -> Bool {
        guard let event else { return false }
        if event.type == .keyDown && event.modifierFlags.contains([.control, .shift]) &&
            event.keyCode == 11 { // Ctrl+Shift+B
            startVoice()
            return true
        }
        return false
    }

    private func startVoice() {
        if !ConsentStore.voiceConsent {
            panel.setState(.error)
            panel.showPreview("Voice consent is off — enable it in settings")
            panel.orderFrontRegardless()
            return
        }
        panel.setState(.listening)
        panel.orderFrontRegardless()
        _ = speech.start()
    }

    private func insert(_ text: String) {
        guard !text.isEmpty else { return }
        client()?.insertText(text, replacementRange: NSRange(location: NSNotFound, length: NSNotFound))
    }
}
