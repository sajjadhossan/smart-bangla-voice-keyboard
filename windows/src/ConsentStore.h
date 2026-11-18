#pragma once

#include <windows.h>

#include <string>

/** Consent is off by default. API key is DPAPI-encrypted under HKCU. */
class ConsentStore
{
public:
    static bool VoiceConsent();
    static void SetVoiceConsent(bool granted);

    static std::wstring ReadApiKey();
    static bool SaveApiKey(const std::wstring& key);
    static void ClearApiKey();

private:
    static constexpr wchar_t kRoot[] =
        L"Software\\SmartBanglaVoiceKeyboard";
};
