#include "VoicePopup.h"

#include <commctrl.h>

namespace
{
    constexpr UINT WM_SET_VOICE_STATE = WM_APP + 1;
    constexpr UINT WM_SET_PREVIEW = WM_APP + 2;
    constexpr wchar_t kWindowClass[] = L"SmartBanglaVoicePopup";

    struct PopupPayload
    {
        VoicePopup* owner;
        VoiceState state{VoiceState::Idle};
        std::wstring preview;
    };
}

const wchar_t* VoiceStateLabel(VoiceState state)
{
    switch (state)
    {
        case VoiceState::Idle:         return L"IDLE — mic ready";
        case VoiceState::Listening:    return L"LISTENING…";
        case VoiceState::Processing:   return L"PROCESSING…";
        case VoiceState::Transcribing: return L"TRANSCRIBING…";
        case VoiceState::Correcting:   return L"CORRECTING…";
        case VoiceState::Translating:  return L"TRANSLATING…";
        case VoiceState::ResultReady:  return L"RESULT READY";
        case VoiceState::Inserting:    return L"INSERTING…";
        case VoiceState::Completed:    return L"COMPLETED";
        case VoiceState::Error:        return L"ERROR";
        case VoiceState::Cancelled:    return L"CANCELLED";
    }
    return L"IDLE";
}

void VoicePopup::Create(ToggleCallback onToggle)
{
    if (m_thread != nullptr) return;
    m_onToggle = std::move(onToggle);
    m_thread = ::CreateThread(nullptr, 0, &VoicePopup::ThreadProc, this, 0, &m_threadId);
}

DWORD VoicePopup::ThreadProc(LPVOID self)
{
    auto* popup = static_cast<VoicePopup*>(self);
    WNDCLASSEXW wc{};
    wc.cbSize = sizeof(wc);
    wc.lpfnWndProc = &VoicePopup::WndProc;
    wc.hInstance = ::GetModuleHandle(nullptr);
    wc.lpszClassName = kWindowClass;
    wc.hbrBackground = reinterpret_cast<HBRUSH>(COLOR_WINDOW + 1);
    ::RegisterClassExW(&wc);

    popup->m_hwnd = ::CreateWindowExW(
        WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE,
        kWindowClass, L"Smart Bangla Voice Keyboard",
        WS_POPUP | WS_BORDER | WS_SYSMENU,
        200, 200, 380, 190, nullptr, nullptr, wc.hInstance, popup);
    if (popup->m_hwnd == nullptr) return 1;

    ::ShowWindow(popup->m_hwnd, SW_SHOW);
    MSG msg{};
    while (::GetMessageW(&msg, nullptr, 0, 0) > 0)
    {
        ::TranslateMessage(&msg);
        ::DispatchMessageW(&msg);
        if (msg.message == WM_QUIT) break;
    }
    return 0;
}

LRESULT VoicePopup::WndProc(HWND hwnd, UINT msg, WPARAM wparam, LPARAM lparam)
{
    auto* popup = reinterpret_cast<VoicePopup*>(
        ::GetWindowLongPtrW(hwnd, GWLP_USERDATA));

    switch (msg)
    {
        case WM_CREATE:
        {
            auto* create = reinterpret_cast<CREATESTRUCTW*>(lparam);
            ::SetWindowLongPtrW(hwnd, GWLP_USERDATA,
                reinterpret_cast<LONG_PTR>(create->lpCreateParams));
            return 0;
        }
        case WM_NCHITTEST:
            // Let the user drag the whole panel by its title area.
            return HTCAPTION;
        case WM_SET_VOICE_STATE:
            ::SetWindowTextW(hwnd, VoiceStateLabel(static_cast<VoiceState>(wparam)));
            return 0;
        case WM_SET_PREVIEW:
        {
            auto* text = reinterpret_cast<const std::wstring*>(lparam);
            if (text != nullptr) ::SetWindowTextW(hwnd, text->c_str());
            return 0;
        }
        case WM_LBUTTONDBLCLK:
            if (popup != nullptr && popup->m_onToggle) popup->m_onToggle();
            return 0;
        case WM_KEYDOWN:
            if (wparam == VK_ESCAPE)
            {
                if (popup != nullptr) ::PostMessageW(hwnd, WM_SET_VOICE_STATE,
                    static_cast<WPARAM>(VoiceState::Cancelled), 0);
                return 0;
            }
            return 0;
        case WM_DESTROY:
            ::PostQuitMessage(0);
            return 0;
        default:
            return ::DefWindowProcW(hwnd, msg, wparam, lparam);
    }
}

void VoicePopup::Toggle()
{
    if (m_hwnd == nullptr) return;
    ::ShowWindow(m_hwnd, ::IsWindowVisible(m_hwnd) ? SW_HIDE : SW_SHOW);
}

void VoicePopup::SetState(VoiceState state)
{
    if (m_hwnd != nullptr)
        ::PostMessageW(m_hwnd, WM_SET_VOICE_STATE, static_cast<WPARAM>(state), 0);
}

void VoicePopup::SetPreview(const std::wstring& text)
{
    // The string must outlive the posted message; keep it in the popup object.
    m_previewStorage = text;
    if (m_hwnd != nullptr)
        // Synchronous so the pointer stays valid for the whole handler.
        ::SendMessageW(m_hwnd, WM_SET_PREVIEW, 0,
            reinterpret_cast<LPARAM>(&m_previewStorage));
}

void VoicePopup::Destroy()
{
    if (m_hwnd != nullptr)
    {
        ::PostMessageW(m_hwnd, WM_CLOSE, 0, 0);
        ::DestroyWindow(m_hwnd);
        m_hwnd = nullptr;
    }
    if (m_thread != nullptr)
    {
        ::WaitForSingleObject(m_thread, 2000);
        ::CloseHandle(m_thread);
        m_thread = nullptr;
    }
}
