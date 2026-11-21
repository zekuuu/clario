; Clario installer hooks (bundle.windows.nsis.installerHooks).
;
; Data lives in "<install folder>\data". The stock installer/uninstaller never touch that folder:
; files are removed one by one and $INSTDIR is removed non-recursively, so data survives updates,
; reinstalls and a plain uninstall.

!define CLARIO_DATA_MARKER ".clario-data-folder"

!macro NSIS_HOOK_POSTINSTALL
  ; Only claim a data folder we create ourselves. If "<install folder>\data" already existed (e.g. the
  ; user installed into a folder that has an unrelated "data" subfolder), it gets no marker and the
  ; uninstaller will never delete it.
  ${IfNot} ${FileExists} "$INSTDIR\data\*.*"
    CreateDirectory "$INSTDIR\data"
    FileOpen $0 "$INSTDIR\data\${CLARIO_DATA_MARKER}" w
    FileWrite $0 "Created by the Clario installer. Uninstall may delete this folder only when this file is present."
    FileClose $0
  ${EndIf}

  ; An "everyone" install lives in Program Files, which normal users cannot write to. Grant the built-in
  ; Users group (SID S-1-5-32-545, language independent) Modify rights on the data folder only.
  ${If} $MultiUser.InstallMode == "AllUsers"
    nsExec::ExecToLog 'icacls "$INSTDIR\data" /grant *S-1-5-32-545:(OI)(CI)M'
    Pop $0
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; This Tauri version only sets the checkbox state from the GUI; also honour "/DELETEAPPDATA" for
  ; silent/scripted uninstalls (uninstall.exe /S /DELETEAPPDATA).
  ${GetOptions} $CMDLINE "/DELETEAPPDATA" $R0
  ${IfNot} ${Errors}
    StrCpy $DeleteAppDataCheckboxState 1
  ${EndIf}

  ; "Also delete my sessions and reports" checkbox (unchecked by default). Never during an update.
  ${If} $DeleteAppDataCheckboxState = 1
  ${AndIf} $UpdateMode <> 1
  ${AndIf} ${FileExists} "$INSTDIR\data\${CLARIO_DATA_MARKER}"
    RMDir /r "$INSTDIR\data"
    RMDir "$INSTDIR"
  ${EndIf}
!macroend
