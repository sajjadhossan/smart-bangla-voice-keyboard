import AVFoundation
import Speech

/// Consent-gated speech recognition. No consent ⇒ no engine, no request,
/// no microphone and no recognizer is created.
final class SpeechCapture {
    private let audioEngine = AVAudioEngine()
    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "bn-BD"))
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?

    var onPartial: ((String) -> Void)?
    var onFinal: ((String) -> Void)?
    var onError: (() -> Void)?

    func start() -> Bool {
        guard ConsentStore.voiceConsent else {
            onError?()
            return false
        }
        guard let recognizer, recognizer.isAvailable else {
            onError?()
            return false
        }

        stop()
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        self.request = request

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            request.append(buffer)
        }

        do {
            audioEngine.prepare()
            try audioEngine.start()
        } catch {
            onError?()
            return false
        }

        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            guard let self else { return }
            if let result {
                let text = result.bestTranscription.formattedString
                if result.isFinal {
                    self.stop()
                    self.onFinal?(text)
                } else {
                    self.onPartial?(text)
                }
                return
            }
            if error != nil {
                self.stop()
                self.onError?()
            }
        }
        return true
    }

    func stop() {
        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
        }
        task?.cancel()
        task = nil
        request = nil
    }
}
