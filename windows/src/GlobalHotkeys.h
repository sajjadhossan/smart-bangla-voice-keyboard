#pragma once

#include <windows.h>

#include <functional>
#include <vector>

/**
 * Registers a global hotkey with explicit conflict detection. If a candidate
 * is already owned by another application, the next candidate is tried and the
 * conflict is recorded for the settings UI / tray tooltip.
 */
class GlobalHotkeys
{
public:
    struct Registration
    {
        UINT modifiers{0};
        UINT virtualKey{0};
        int  id{0};
        bool registered{false};
    };

    using Callback = std::function<void()>;

    void Register(Callback callback);
    void Unregister();

    /** Called from the WM_HOTKEY handler on the host thread. */
    void OnHotkey(int id);

    const std::vector<Registration>& Registrations() const { return m_registrations; }

private:
    static constexpr int kBaseId = 0x5B41;
    static constexpr UINT kModifiers = MOD_CONTROL | MOD_SHIFT;

    Callback m_callback;
    std::vector<Registration> m_registrations;
};
