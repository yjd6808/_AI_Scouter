#Requires -Version 5.1
param(
	[ValidateSet("hover", "click", "rclick")][string]$Action = "hover",
	[int]$X = 0,
	[int]$Y = 0
)
$ErrorActionPreference = "Stop"
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MouseOps {
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, UIntPtr dwExtraInfo);
    public const int LEFTDOWN = 0x02;
    public const int LEFTUP = 0x04;
    public const int RIGHTDOWN = 0x08;
    public const int RIGHTUP = 0x10;
}
"@

[MouseOps]::SetCursorPos($X, $Y) | Out-Null;
Start-Sleep -Milliseconds 300;
if ($Action -eq "click") {
	[MouseOps]::mouse_event([MouseOps]::LEFTDOWN, 0, 0, 0, [UIntPtr]::Zero);
	Start-Sleep -Milliseconds 100;
	[MouseOps]::mouse_event([MouseOps]::LEFTUP, 0, 0, 0, [UIntPtr]::Zero);
}
if ($Action -eq "rclick") {
	[MouseOps]::mouse_event([MouseOps]::RIGHTDOWN, 0, 0, 0, [UIntPtr]::Zero);
	Start-Sleep -Milliseconds 100;
	[MouseOps]::mouse_event([MouseOps]::RIGHTUP, 0, 0, 0, [UIntPtr]::Zero);
}
Write-Output "DONE:$Action $X,$Y";
