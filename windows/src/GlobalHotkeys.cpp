#include "GlobalHotkeys.h"

void GlobalHotkeys::Register(Callback callback)
{
    m_callback = std::move(callback);
    // Ordered candidates: prefer the documented shortcut, fall back cleanly.
    const UINT candidates[] = { 'B', 'K', 'J', 'M' };

    for (UINT key : candidates)
    {
        Registration entry{kModifiers, key, kBaseId + static_cast<int>(m_registrations.size()), false};
        entry.registered = ::RegisterHotKey(nullptr, entry.id, entry.modifiers, entry.virtualKey) != FALSE;
        m_registrations.push_back(entry);
        if (entry.registered) break; // exactly one active hotkey
    }
}

void GlobalHotkeys::Unregister()
{
    for (const Registration& entry : m_registrations)
    {
        if (entry.registered) ::UnregisterHotKey(nullptr, entry.id);
    }
    m_registrations.clear();
}

void GlobalHotkeys::OnHotkey(int id)
{
    for (const Registration& entry : m_registrations)
    {
        if (entry.id == id && entry.registered && m_callback)
        {
            m_callback();
            return;
        }
    }
}
