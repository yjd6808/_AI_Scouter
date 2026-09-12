#Requires -Version 5.1
param(
	[string]$Title = "Scouter",
	[string]$Out = "$env:TEMP\opencode\scouter-screen.png"
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing;
Add-Type -AssemblyName System.Windows.Forms;
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinCap {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rc);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

$procs = Get-Process | Where-Object { $_.MainWindowTitle -eq $Title };
if ($procs.Count -eq 0) { Write-Output "NO_WINDOW"; exit 1; }
$hwnd = $procs[0].MainWindowHandle;
if ([WinCap]::IsIconic($hwnd)) { [WinCap]::ShowWindow($hwnd, 9) | Out-Null; }
[WinCap]::SetForegroundWindow($hwnd) | Out-Null;
Start-Sleep -Milliseconds 800;
$rc = New-Object WinCap+RECT;
[WinCap]::GetWindowRect($hwnd, [ref]$rc) | Out-Null;
$L = [int]$rc.Left; $T = [int]$rc.Top; $W = [int]$rc.Right - $L; $H = [int]$rc.Bottom - $T;
$dir = Split-Path -Parent $Out;
if ($dir -ne "" -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null; }
$bmp = New-Object Drawing.Bitmap($W, $H);
$gfx = [Drawing.Graphics]::FromImage($bmp);
$gfx.CopyFromScreen($L, $T, 0, 0, (New-Object Drawing.Size($W, $H)));
$gfx.Dispose();
$bmp.Save($Out, [Drawing.Imaging.ImageFormat]::Png);
$bmp.Dispose();
Write-Output "SAVED:$Out";
