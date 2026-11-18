#include "TextInsertion.h"

bool TextInsertion::Insert(const std::wstring& text)
{
    if (text.empty() || !m_manager) return false;

    CComPtr<ITfDocumentMgr> focused;
    if (FAILED(m_manager->GetFocus(&focused)) || !focused) return false;

    CComPtr<ITfContext> context;
    if (FAILED(focused->GetTop(&context)) || !context) return false;

    CComPtr<ITfInsertAtSelection> insertAtSelection;
    if (FAILED(context->QueryInterface(IID_PPV_ARGS(&insertAtSelection)))) return false;

    // TS_IAS_NOQUERY: we do not need the resulting range. Insertion happens in
    // the document that already has keyboard focus — no SetForegroundWindow,
    // no SendInput, no clipboard. This is the focus-preserving path.
    CComPtr<ITfRange> range;
    const HRESULT hr = insertAtSelection->InsertTextAtSelection(
        TF_IAS_NOQUERY, text.c_str(), static_cast<LONG>(text.size()), &range, nullptr);
    return SUCCEEDED(hr);
}
