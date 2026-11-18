#include "TrayIcon.h"

#include <shellapi.h>

namespace
{
    TrayIcon* g_instance = nullptr;

    LRESULT CALLBACK TrayWndProc(HWND hwnd, UINT msg, WPARAM wparam, LPARAM lparam)
    {
        if (msg == TrayIcon::kMessage && LOWORD(lparam) == TrayIcon::kId)
        {
            if (g_instance != nullptr) g_instance->OnActivate();
            return 0;
        }
        return ::DefWindowProcW(hwnd, msg, wparam, lparam);
    }
}

void TrayIcon::OnActivate()
{
    if (m_callback) m_callback();
}

void TrayIcon::Create(Callback onActivate)
{
    if (m_created) return;
    m_callback = std::move(onActivate);

    WNDCLASSEXW wc{};
    wc.cbSize = sizeof(wc);
    wc.lpfnWndProc = &TrayWndProc;
    wc.hInstance = ::GetModuleHandle(nullptr);
    wc.lpszClassName = L"SmartBanglaTrayWindow";
    ::RegisterClassExW(&wc);

    m_hwnd = ::CreateWindowExW(0, wc.lpszClassName, L"SmartBanglaTray",
                               WS_OVERLAPPEDWINDOW, 0, 0, 0, 0,
                               HWND_MESSAGE, nullptr, wc.hInstance, nullptr);
    if (m_hwnd == nullptr) return;

    g_instance = this;
    NOTIFYICONDATAW data{};
    data.cbSize = sizeof(data);
    data.hWnd = m_hwnd;
    data.uID = kId;
    data.uFlags = NIF_MESSAGE | NIF_ICON | NIF_TIP;
    data.uCallbackMessage = kMessage;
    data.hIcon = ::LoadIcon(nullptr, IDI_APPLICATION);
    ::wcscpy_s(data.szTip, L"Smart Bangla Voice Keyboard");
    m_created = ::Shell_NotifyIconW(NIM_ADD, &data) != FALSE;
}

void TrayIcon::Destroy()
{
    if (!m_created) {
        if (m_hwnd != nullptr) ::DestroyWindow(m_hwnd);
        m_hwnd = nullptr;
        return;
    }

    NOTIFYICONDATAW data{};
    data.cbSize = sizeof(data);
    data.hWnd = m_hwnd;
    data.uID = kId;
    ::Shell_NotifyIconW(NIM_DELETE, &data);
    ::DestroyWindow(m_hwnd);
    m_hwnd = nullptr;
    m_created = false;
    if (g_instance == this) g_instance = nullptr;
}
