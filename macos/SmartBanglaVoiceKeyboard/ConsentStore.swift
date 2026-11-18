import Foundation
import Security

/// Consent is OFF by default. The API key is stored in the Keychain, never in
/// UserDefaults or a plaintext file.
enum ConsentStore {
    private enum Key {
        static let voiceConsent = "sbvk.voiceConsent"
        static let textConsent = "sbvk.textConsent"
        static let apiKey = "sbvk.gemini.apiKey"
    }

    static var voiceConsent: Bool {
        get { UserDefaults.standard.bool(forKey: Key.voiceConsent) }
        set { UserDefaults.standard.set(newValue, forKey: Key.voiceConsent) }
    }

    static var textConsent: Bool {
        get { UserDefaults.standard.bool(forKey: Key.textConsent) }
        set { UserDefaults.standard.set(newValue, forKey: Key.textConsent) }
    }

    static func saveAPIKey(_ key: String) -> Bool {
        guard let data = key.data(using: .utf8), !key.isEmpty else { return false }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: Key.apiKey,
            kSecAttrService as String: Bundle.main.bundleIdentifier ?? "SmartBanglaVoiceKeyboard",
        ]
        SecItemDelete(query as CFDictionary)
        let attributes: [String: Any] = query.merging([
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        ]) { _, new in new }
        return SecItemAdd(attributes as CFDictionary, nil) == errSecSuccess
    }

    static func readAPIKey() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: Key.apiKey,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func clearAPIKey() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: Key.apiKey,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
