#pragma once

#include <windows.h>

#include <functional>
#include <string>

/** Mirrors shared/core/types.ts VoiceState — all eleven states. */
enum class VoiceState
{
    Idle, Listening, Processing, Transcribing, Correcting, Translating,
    ResultReady, Inserting, Completed, Error, Cancelled
};

const wchar_t* VoiceStateLabel(VoiceState state);

/**
 * Real draggable floating Win32 window. It owns a UI thread so it keeps
 * responding even when the TSF host is busy. No transcript is inserted until
 * the user explicitly accepts it.
 */
class VoicePopup
{
public:
    using ToggleCallback = std::function<void()>;

    VoicePopup() = default;
    ~VoicePopup() { Destroy(); }
    VoicePopup(const VoicePopup&) = delete;
    VoicePopup& operator=(const VoicePopup&) = delete;

    void Create(ToggleCallback onToggle);
    void Toggle();
    void SetState(VoiceState state);
    void SetPreview(const std::wstring& text);
    void Destroy();

private:
    static DWORD WINAPI ThreadProc(LPVOID self);
    static LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wparam, LPARAM lparam);

    HWND   m_hwnd{nullptr};
    HANDLE m_thread{nullptr};
    DWORD  m_threadId{0};
    ToggleCallback m_onToggle;
    std::wstring m_previewStorage;
};
