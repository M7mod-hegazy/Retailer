Option Explicit
Dim shell, fso, root, ps1, pwsh, cmd

Set shell = CreateObject("WScript.Shell")
Set fso   = CreateObject("Scripting.FileSystemObject")

root = fso.GetParentFolderName(WScript.ScriptFullName)
ps1  = root & "\launcher\web.ps1"
pwsh = "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"

If Not fso.FileExists(ps1) Then
    MsgBox "Launcher file not found:" & vbCrLf & ps1, 16, "Error"
    WScript.Quit
End If

cmd = Chr(34) & pwsh & Chr(34) & " -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File " & Chr(34) & ps1 & Chr(34)
shell.Run cmd, 0, False
