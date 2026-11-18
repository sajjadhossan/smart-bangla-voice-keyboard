#pragma once

#include <atlbase.h>
#include <msctf.h>

#include <string>

/** Inserts committed text into the CURRENT TSF focus context. */
class TextInsertion
{
public:
    void Initialize(ITfThreadMgr* manager, TfClientId clientId)
    {
        m_manager = manager;
        m_clientId = clientId;
    }

    /** Returns false when no editable field has focus; never steals focus. */
    bool Insert(const std::wstring& text);

private:
    CComPtr<ITfThreadMgr> m_manager;
    TfClientId m_clientId{TF_CLIENTID_NULL};
};
