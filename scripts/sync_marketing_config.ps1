param(
    [string]$SourceDir = "D:\wmshare\telua_flower\config\anne",
    [string]$TargetDir = "D:\code\telua_public_marketing\config\anne"
)

Write-Host "======================================================================"
Write-Host "BAT DAU DONG BO CAU TRUC DA NGON NGU CHO TELUA MARKETING CONFIG"
Write-Host "Nguon chuan: $SourceDir"
Write-Host "Thu muc dich: $TargetDir"
Write-Host "======================================================================"

if (-not (Test-Path $SourceDir)) {
    Write-Host "Loi: Thu muc nguon khong ton tai: $SourceDir"
    exit 1
}

# 1. Tu dong sao luu thu muc cu neu ton tai
if (Test-Path $TargetDir) {
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupDir = "${TargetDir}_backup_$timestamp"
    Write-Host "Dang tao ban sao luu tai: $backupDir ..."
    try {
        Copy-Item -Path $TargetDir -Destination $backupDir -Recurse -Force
        Write-Host "Sao luu thanh cong!"
    } catch {
        Write-Host "Canh bao khi sao luu: $_"
    }
} else {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

# 2. Sao chep toan bo thu muc & tap tin JSON sang dich
Write-Host "Dang dong bo cac tap tin JSON..."
$files = Get-ChildItem -Path $SourceDir -Recurse -File -Filter "*.json"

foreach ($file in $files) {
    $relativePath = $file.FullName.Substring($SourceDir.Length).TrimStart("\", "/")
    $destFilePath = Join-Path $TargetDir $relativePath
    $destFileDir = Split-Path $destFilePath -Parent

    if (-not (Test-Path $destFileDir)) {
        New-Item -ItemType Directory -Path $destFileDir -Force | Out-Null
    }

    Copy-Item -Path $file.FullName -Destination $destFilePath -Force
    Write-Host "  [OK] Dong bo: $relativePath"
}

Write-Host "======================================================================"
Write-Host "HOAN TAT DONG BO! Toan bo cau truc Da Ngon Ngu da san sang."
Write-Host "Dich: $TargetDir"
Write-Host "======================================================================"
