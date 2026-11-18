#pragma once

#include <atlbase.h>
#include <atlcom.h>
#include <msctf.h>

#include "TextInsertion.h"
#include "VoicePopup.h"
#include "GlobalHotkeys.h"
#include "TrayIcon.h"

// {6E7A1C31-5B0D-4D5E-9A31-2C7F0B3E9D41} — our own CLSID (not a Microsoft one).
class DECLSPEC_UUID("6E7A1C31-5B0D-4D5E-9A31-2C7F0B3E9D41")
    ATL_NO_VTABLE CBanglaIme :
    public CComObjectRootEx<CComSingleThreadModel>,
    public CComCoClass<CBanglaIme, &__uuidof(CBanglaIme)>,
    public ITfTextInputProcessor
{
public:
    CBanglaIme() = default;

    DECLARE_REGISTRY_RESOURCEID(IDR_BANGLAIME)
    DECLARE_NOT_AGGREGATABLE(CBanglaIme)

    BEGIN_COM_MAP(CBanglaIme)
        COM_INTERFACE_ENTRY(ITfTextInputProcessor)
    END_COM_MAP()

    DECLARE_PROTECT_FINAL_CONSTRUCT()

    HRESULT FinalConstruct() { return S_OK; }
    void FinalRelease() { ShutdownUi(); }

    // ITfTextInputProcessor
    STDMETHODIMP Activate(ITfThreadMgr* ptim, TfClientId tid) override;
    STDMETHODIMP Deactivate() override;
    STDMETHODIMP KeyDown(ULONG virtualKey, ULONG scanCode, BOOL* eaten) override;
    STDMETHODIMP KeyUp(ULONG virtualKey, ULONG scanCode, BOOL* eaten) override;
    STDMETHODIMP SetFocus(ITfDocumentMgr* focus) override;

    // Called by the popup / tray when a transcription is accepted.
    void OnTextReady(const std::wstring& text);
    // Hotkey / tray activation: consent gate → capture → preview → accept.
    void OnToggleRequested();

private:
    void ShutdownUi();

    CComPtr<ITfThreadMgr>   m_threadMgr;
    CComPtr<ITfDocumentMgr> m_focus;
    TfClientId              m_clientId{TF_CLIENTID_NULL};

    TextInsertion m_insertion;
    VoicePopup    m_popup;
    GlobalHotkeys m_hotkeys;
    TrayIcon      m_tray;
    std::wstring  m_pendingTranscript;
    bool          m_active{false};
};

OBJECT_ENTRY_AUTO(__uuidof(CBanglaIme), CBanglaIme)
