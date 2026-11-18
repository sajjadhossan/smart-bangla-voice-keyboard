#pragma once

#include <windows.h>

#include <functional>

/** Per-user shell tray icon; double-click toggles the voice popup. */
class TrayIcon
{
public:
    static constexpr UINT kMessage = WM_APP + 10;
    static constexpr UINT kId = 1;

    using Callback = std::function<void()>;

    void Create(Callback onActivate);
    void Destroy();

    /** Called from the hidden window's WndProc. */
    void OnActivate();

private:
    Callback m_callback;
    HWND     m_hwnd{nullptr};
    bool     m_created{false};
};
