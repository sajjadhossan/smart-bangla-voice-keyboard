cmake_minimum_required(VERSION 3.20)
project(SmartBanglaIme LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
add_definitions(-DUNICODE -D_UNICODE -DWIN32_LEAN_AND_MEAN -DSTRICT)

# C++/WinRT is required for SpeechRecognizer. Only available on Windows with
# VS 2019+ / Windows SDK; this project is NOT built on non-Windows hosts.
find_package(cppwinrt REQUIRED)

add_library(SmartBanglaIme SHARED
    src/dllmain.cpp
    src/BanglaIme.cpp
    src/VoicePopup.cpp
    src/GlobalHotkeys.cpp
    src/TrayIcon.cpp
    src/TextInsertion.cpp
    src/ConsentStore.cpp
    src/VoiceCapture.cpp
    src/BanglaIme.rc
)

target_include_directories(SmartBanglaIme PRIVATE src)
target_link_libraries(SmartBanglaIme PRIVATE
    msctf ole32 user32 shell32 advapi32 comctl32 windowsapp
)

# TSF COM servers must be registered per-user (no admin) before use.
add_custom_command(TARGET SmartBanglaIme POST_BUILD
    COMMAND "${CMAKE_COMMAND}" -E echo
            "Register per-user with: regsvr32 /n /i:user SmartBanglaIme.dll"
    VERBATIM)
