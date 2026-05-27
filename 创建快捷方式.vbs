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
  ' Look for old versions by checking for "Claude" or non-ascii characters in name
  ' Or just anything that isn't our new shortcut and is a .vbs or .lnk
  If InStr(file.Name, "Claude") > 0 Or InStr(file.Name, "AI") > 0 Then
    If Right(file.Name, 4) = ".vbs" Or Right(file.Name, 4) = ".lnk" Then
      If file.Name <> "AI-Config-Launcher.lnk" Then
        FSO.DeleteFile(file.Path)
      End If
    End If
  End If
Next
On Error Goto 0

' Find node.exe
nodeExe = ""
On Error Resume Next
Set exec = WshShell.Exec("cmd /c where node 2>nul")
nodeExe = exec.StdOut.ReadLine()
If nodeExe = "" Then
  nodeExe = WshShell.RegRead("HKLM\SOFTWARE\Node.js\InstallPath")
  If nodeExe <> "" Then nodeExe = nodeExe & "\node.exe"
End If
On Error Goto 0

If nodeExe <> "" Then
  Set shortcut = WshShell.CreateShortcut(shortcutPath)
  shortcut.TargetPath = nodeExe
  shortcut.Arguments = """" & scriptDir & "\launcher.js"""
  shortcut.WorkingDirectory = scriptDir
  shortcut.WindowStyle = 7
  shortcut.Description = "AI Config Switcher - On-demand launcher"
  shortcut.Save()
Else
  ' Use cmd if node not found in path
  Set shortcut = WshShell.CreateShortcut(shortcutPath)
  shortcut.TargetPath = "cmd.exe"
  shortcut.Arguments = "/c node launcher.js"
  shortcut.WorkingDirectory = scriptDir
  shortcut.WindowStyle = 7
  shortcut.Description = "AI Config Switcher - On-demand launcher"
  shortcut.Save()
End If

WshShell.Popup "Shortcut created at: " & shortcutPath, 3, "AI Config Switcher", 64
