#pragma once

#include <functional>
#include <string>

/**
 * Windows speech capture via WinRT SpeechRecognizer. Starts ONLY when the
 * encrypted consent store says voice is allowed; otherwise the callback
 * receives an empty transcript and no recognizer is constructed.
 */
class VoiceCapture
{
public:
    using ResultCallback = std::function<void(const std::wstring&)>;

    /** Blocking recognition for clarity of the consent gate and error path. */
    static bool Listen(ResultCallback onResult);
};
