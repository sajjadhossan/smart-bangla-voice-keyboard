#include "BanglaIme.h"

#include "ConsentStore.h"
#include "VoiceCapture.h"

#include <cassert>

STDMETHODIMP CBanglaIme::Activate(ITfThreadMgr* ptim, TfClientId tid)
{
    if (m_active || ptim == nullptr) return E_INVALIDARG;
    m_threadMgr = ptim;
    m_clientId = tid;

    // Register this CLSID under GUID_TFCAT_TIP_KEYBOARD so TSF lists it as a
    // keyboard. Per-user registration is done by the .rgs script at install.
    CComPtr<ITfCategoryMgr> categories;
    if (SUCCEEDED(ptim->QueryInterface(IID_PPV_ARGS(&categories)))) {
        categories->RegisterCategory(__uuidof(CBanglaIme), GUID_TFCAT_TIP_KEYBOARD,
                                     __uuidof(CBanglaIme));
    }

    m_insertion.Initialize(ptim, m_clientId);
    m_hotkeys.Register([this]() { OnToggleRequested(); });
    m_tray.Create([this]() { OnToggleRequested(); });
    m_active = true;
    return S_OK;
}

STDMETHODIMP CBanglaIme::Deactivate()
{
    if (!m_active) return S_OK;
    ShutdownUi();
    m_focus.Release();
    m_threadMgr.Release();
    m_active = false;
    return S_OK;
}

STDMETHODIMP CBanglaIme::KeyDown(ULONG virtualKey, ULONG scanCode, BOOL* eaten)
{
    (void)scanCode;
    if (eaten != nullptr) *eaten = FALSE;
    // Offline layer: TSF keystroke handling is intentionally conservative.
    // Text is committed through a TSF composition (see TextInsertion), never
    // by stealing focus with SendInput.
    return S_OK;
}

STDMETHODIMP CBanglaIme::KeyUp(ULONG virtualKey, ULONG scanCode, BOOL* eaten)
{
    (void)virtualKey; (void)scanCode;
    if (eaten != nullptr) *eaten = FALSE;
    return S_OK;
}

STDMETHODIMP CBanglaIme::SetFocus(ITfDocumentMgr* focus)
{
    m_focus = focus;
    return S_OK;
}

void CBanglaIme::OnTextReady(const std::wstring& text)
{
    if (!m_active || text.empty()) return;
    m_insertion.Insert(text);   // focus-preserving TSF insertion
    m_popup.SetState(VoiceState::Completed);
}

void CBanglaIme::OnToggleRequested()
{
    // First activation with a pending transcript means the user accepted the
    // preview; insertion always follows an explicit second action.
    if (!m_pendingTranscript.empty())
    {
        const std::wstring accepted = m_pendingTranscript;
        m_pendingTranscript.clear();
        m_popup.SetState(VoiceState::Inserting);
        OnTextReady(accepted);
        return;
    }

    if (!ConsentStore::VoiceConsent())
    {
        m_popup.SetState(VoiceState::Error);
        m_popup.SetPreview(L"Voice consent required — enable it in settings");
        return;
    }

    m_popup.SetState(VoiceState::Listening);
    VoiceCapture::Listen([this](const std::wstring& transcript)
    {
        if (transcript.empty())
        {
            m_popup.SetState(VoiceState::Error);
            return;
        }
        m_pendingTranscript = transcript;
        m_popup.SetState(VoiceState::ResultReady);
        m_popup.SetPreview(transcript);
    });
}

void CBanglaIme::ShutdownUi()
{
    m_hotkeys.Unregister();
    m_tray.Destroy();
    m_popup.Destroy();
}
