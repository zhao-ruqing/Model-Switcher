' Cleanup script for AI Config Switcher
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

startupDir = WshShell.SpecialFolders("Startup")
Set folder = FSO.GetFolder(startupDir)

count = 0
For Each file In folder.Files
  ' Match our created shortcuts and old scripts
  ' Use simple names to avoid encoding issues
  If InStr(file.Name, "AI") > 0 Or InStr(file.Name, "Claude") > 0 Then
    If Right(LCase(file.Name), 4) = ".lnk" Or Right(LCase(file.Name), 4) = ".vbs" Then
      FSO.DeleteFile(file.Path)
      count = count + 1
    End If
  End If
Next

WshShell.Popup "Cleaned up " & count & " startup items.", 3, "AI Config Switcher", 64
