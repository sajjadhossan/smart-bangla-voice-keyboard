import Foundation

/// Mirrors shared/core/types.ts — all eleven states, one label each.
enum VoiceState: String, CaseIterable {
    case idle = "IDLE"
    case listening = "LISTENING"
    case processing = "PROCESSING"
    case transcribing = "TRANSCRIBING"
    case correcting = "CORRECTING"
    case translating = "TRANSLATING"
    case resultReady = "RESULT_READY"
    case inserting = "INSERTING"
    case completed = "COMPLETED"
    case error = "ERROR"
    case cancelled = "CANCELLED"

    var label: String {
        switch self {
        case .idle: return "IDLE — mic ready"
        case .listening: return "LISTENING…"
        case .processing: return "PROCESSING…"
        case .transcribing: return "TRANSCRIBING…"
        case .correcting: return "CORRECTING…"
        case .translating: return "TRANSLATING…"
        case .resultReady: return "RESULT READY"
        case .inserting: return "INSERTING…"
        case .completed: return "COMPLETED"
        case .error: return "ERROR"
        case .cancelled: return "CANCELLED"
        }
    }
}
