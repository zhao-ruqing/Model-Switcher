' Create shortcut in startup folder
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

scriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
startupDir = WshShell.SpecialFolders("Startup")
shortcutPath = startupDir & "\AI-Config-Launcher.lnk"

' Cleanup old scripts/shortcuts
On Error Resume Next
Set folder = FSO.GetFolder(startupDir)
For Each file In folder.Files
  If InStr(file.Name, "Claude") > 0 Or InStr(file.Name, "AI") > 0 Then
    If Right(file.Name, 4) = ".vbs" Or Right(file.Name, 4) = ".lnk" Then
      If file.Name <> "AI-Config-Launcher.lnk" Then
        FSO.DeleteFile(file.Path)
      End If
    End If
  End If
Next
On Error Goto 0

' Create the shortcut to start-silent.vbs
Set shortcut = WshShell.CreateShortcut(shortcutPath)
shortcut.TargetPath = "wscript.exe"
shortcut.Arguments = """" & scriptDir & "\start-silent.vbs"""
shortcut.WorkingDirectory = scriptDir
shortcut.WindowStyle = 7
shortcut.Description = "AI Config Switcher - Silent Launcher"
shortcut.Save()

WshShell.Popup "Shortcut created in Startup folder successfully.", 3, "AI Config Switcher", 64
