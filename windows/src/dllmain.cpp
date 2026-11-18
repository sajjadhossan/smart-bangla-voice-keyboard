#include <atlbase.h>
#include <atlcom.h>
#include <atlwin.h>

// {1B9E6A42-7C13-4A55-8F0D-6B2E4A9C1F57} — our own library ID.
class DECLSPEC_UUID("1B9E6A42-7C13-4A55-8F0D-6B2E4A9C1F57")
    CSmartBanglaModule : public ATL::CAtlDllModuleT<CSmartBanglaModule>
{
public:
    DECLARE_LIBID(__uuidof(CSmartBanglaModule))
};

CSmartBanglaModule _AtlModule;

extern "C" BOOL WINAPI DllMain(HINSTANCE instance, DWORD reason, LPVOID reserved)
{
    return _AtlModule.DllMain(reason, reserved) != FALSE;
}

STDAPI DllRegisterServer()  { return _AtlModule.DllRegisterServer(); }
STDAPI DllUnregisterServer(){ return _AtlModule.DllUnregisterServer(); }
STDAPI DllCanUnloadNow()    { return _AtlModule.DllCanUnloadNow(); }
STDAPI DllGetClassObject(REFCLSID clsid, REFIID iid, LPVOID* object)
{
    return _AtlModule.DllGetClassObject(clsid, iid, object);
}
