#include "ConsentStore.h"

#include <dpapi.h>
#include <vector>

namespace
{
    bool ReadDword(const wchar_t* name, DWORD& value)
    {
        HKEY key = nullptr;
        if (::RegOpenKeyExW(HKEY_CURRENT_USER, ConsentStore::kRoot, 0, KEY_READ, &key) != ERROR_SUCCESS)
            return false;
        DWORD size = sizeof(value);
        const LONG status = ::RegQueryValueExW(key, name, nullptr, nullptr,
                                               reinterpret_cast<LPBYTE>(&value), &size);
        ::RegCloseKey(key);
        return status == ERROR_SUCCESS;
    }

    void WriteBlob(const wchar_t* name, const std::vector<BYTE>& bytes)
    {
        HKEY key = nullptr;
        ::RegCreateKeyExW(HKEY_CURRENT_USER, ConsentStore::kRoot, 0, nullptr,
                          REG_OPTION_NON_VOLATILE, KEY_WRITE, nullptr, &key, nullptr);
        if (key == nullptr) return;
        ::RegSetValueExW(key, name, 0, REG_BINARY, bytes.data(),
                         static_cast<DWORD>(bytes.size()));
        ::RegCloseKey(key);
    }

    std::vector<BYTE> ReadBlob(const wchar_t* name)
    {
        HKEY key = nullptr;
        if (::RegOpenKeyExW(HKEY_CURRENT_USER, ConsentStore::kRoot, 0, KEY_READ, &key) != ERROR_SUCCESS)
            return {};
        DWORD size = 0;
        ::RegQueryValueExW(key, name, nullptr, nullptr, nullptr, &size);
        std::vector<BYTE> bytes(size);
        ::RegQueryValueExW(key, name, nullptr, nullptr, bytes.data(), &size);
        ::RegCloseKey(key);
        return bytes;
    }
}

constexpr wchar_t ConsentStore::kRoot[];

bool ConsentStore::VoiceConsent()
{
    DWORD value = 0;
    return ReadDword(L"VoiceConsent", value) && value == 1;
}

void ConsentStore::SetVoiceConsent(bool granted)
{
    const DWORD value = granted ? 1 : 0;
    WriteBlob(L"VoiceConsent", std::vector<BYTE>(
        reinterpret_cast<const BYTE*>(&value),
        reinterpret_cast<const BYTE*>(&value) + sizeof(value)));
}

std::wstring ConsentStore::ReadApiKey()
{
    const std::vector<BYTE> sealed = ReadBlob(L"ApiKey");
    if (sealed.empty()) return {};
    DATA_BLOB in{static_cast<DWORD>(sealed.size()), const_cast<BYTE*>(sealed.data())};
    DATA_BLOB out{};
    if (!::CryptUnprotectData(&in, nullptr, nullptr, nullptr, nullptr, 0, &out)) return {};
    std::wstring key(reinterpret_cast<const wchar_t*>(out.pbData), out.cbData / sizeof(wchar_t));
    ::LocalFree(out.pbData);
    return key;
}

bool ConsentStore::SaveApiKey(const std::wstring& key)
{
    if (key.empty()) return false;
    DATA_BLOB in{static_cast<DWORD>(key.size() * sizeof(wchar_t)),
                 reinterpret_cast<BYTE*>(const_cast<wchar_t*>(key.data()))};
    DATA_BLOB out{};
    if (!::CryptProtectData(&in, L"SmartBanglaApiKey", nullptr, nullptr, nullptr, 0, &out))
        return false;
    WriteBlob(L"ApiKey", std::vector<BYTE>(out.pbData, out.pbData + out.cbData));
    ::LocalFree(out.pbData);
    return true;
}

void ConsentStore::ClearApiKey()
{
    HKEY key = nullptr;
    if (::RegOpenKeyExW(HKEY_CURRENT_USER, kRoot, 0, KEY_WRITE, &key) == ERROR_SUCCESS)
    {
        ::RegDeleteValueW(key, L"ApiKey");
        ::RegCloseKey(key);
    }
}
