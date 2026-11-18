#include "VoiceCapture.h"

#include "ConsentStore.h"

#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Media.SpeechRecognition.h>

bool VoiceCapture::Listen(ResultCallback onResult)
{
    // Hard gate: no consent, no recognizer, no microphone, no network.
    if (!ConsentStore::VoiceConsent())
    {
        if (onResult) onResult(L"");
        return false;
    }

    winrt::init_apartment(winrt::apartment_type::single_threaded);
    winrt::Windows::Media::SpeechRecognition::SpeechRecognizer recognizer;
    recognizer.Language(L"bn-BD");

    const auto result = recognizer.RecognizeAsync().get();
    using Status = winrt::Windows::Media::SpeechRecognition::SpeechRecognitionResultStatus;
    if (result.Status() != Status::Success)
    {
        if (onResult) onResult(L"");
        return false;
    }

    const auto text = result.Text();
    if (onResult) onResult(std::wstring(text.begin(), text.end()));
    return true;
}
