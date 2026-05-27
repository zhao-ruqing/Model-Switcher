Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.Run "cmd /c node launcher.js", 0, False

' Wait for launcher to be ready
Dim i, http
For i = 1 To 20
  WScript.Sleep 500
  On Error Resume Next
  Set http = CreateObject("MSXML2.ServerXMLHTTP")
  http.open "GET", "http://localhost:51234", False
  http.setRequestHeader "Cache-Control", "no-cache"
  http.send ""
  If http.status >= 200 Then
    On Error Goto 0
    Exit For
  End If
  On Error Goto 0
Next
Set http = Nothing
