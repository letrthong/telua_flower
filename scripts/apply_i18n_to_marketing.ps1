param(
    [string]$MarketingDir = "D:\code\telua_public_marketing\config\anne",
    [string]$BackupDir = "D:\code\telua_public_marketing\config\anne_backup_20260830_074445",
    [string]$FlowerDir = "D:\wmshare\telua_flower\config\anne"
)

Write-Host "======================================================================"
Write-Host "CAP NHAT RIENG CAC FILE DA NGON NGU CHO MARKETING CONFIG"
Write-Host "======================================================================"

# 1. Khoi phuc lai cac file khac tu ban backup
if (Test-Path $BackupDir) {
    Write-Host "Dang khoi phuc nguyen trang cac file khac tu backup..."
    if (Test-Path $MarketingDir) {
        Remove-Item -Path $MarketingDir -Recurse -Force
    }
    Copy-Item -Path $BackupDir -Destination $MarketingDir -Recurse -Force
    Write-Host "[OK] Da khoi phuc branches.json, infoCompany.json, users, orders..."
}

# 2. Chi cap nhat translations.json
$srcTrans = Join-Path $FlowerDir "translations.json"
$dstTrans = Join-Path $MarketingDir "translations.json"
if (Test-Path $srcTrans) {
    Copy-Item -Path $srcTrans -Destination $dstTrans -Force
    Write-Host "[OK] translations.json -> Cap nhat tu dien 5 ngon ngu"
}

# 3. Chi cap nhat categories.json
$srcCat = Join-Path $FlowerDir "categories.json"
$dstCat = Join-Path $MarketingDir "categories.json"
if (Test-Path $srcCat) {
    Copy-Item -Path $srcCat -Destination $dstCat -Force
    Write-Host "[OK] categories.json -> Cap nhat textId, descTextId, i18n"
}

# 4. Cap nhat i18n cho tung san pham hien co cua marketing
$mktProductsDir = Join-Path $MarketingDir "products"
$flwProductsDir = Join-Path $FlowerDir "products"

if (Test-Path $mktProductsDir) {
    $productFiles = Get-ChildItem -Path $mktProductsDir -Filter "*.json"
    $allUpdatedProducts = @()

    foreach ($file in $productFiles) {
        $flwRefPath = Join-Path $flwProductsDir $file.Name
        
        try {
            $prod = Get-Content -Path $file.FullName -Raw -Encoding UTF8 | ConvertFrom-Json

            if (Test-Path $flwRefPath) {
                $flwRef = Get-Content -Path $flwRefPath -Raw -Encoding UTF8 | ConvertFrom-Json
                if ($flwRef.i18n) { $prod.i18n = $flwRef.i18n }
                if ($flwRef.nameTextId) { $prod.nameTextId = $flwRef.nameTextId }
                if ($flwRef.flowerComposition -and -not $prod.flowerComposition) { $prod.flowerComposition = $flwRef.flowerComposition }
                if ($flwRef.careTips -and -not $prod.careTips) { $prod.careTips = $flwRef.careTips }
                if ($flwRef.dimension -and -not $prod.dimension) { $prod.dimension = $flwRef.dimension }
            } else {
                if (-not $prod.i18n) {
                    $prod | Add-Member -MemberType NoteProperty -Name "i18n" -Value ([PSCustomObject]@{
                        en = [PSCustomObject]@{ name = $prod.name; flowerComposition = $prod.flowerComposition; description = $prod.description; careTips = $prod.careTips }
                        ja = [PSCustomObject]@{ name = $prod.name; flowerComposition = $prod.flowerComposition; description = $prod.description; careTips = $prod.careTips }
                        ko = [PSCustomObject]@{ name = $prod.name; flowerComposition = $prod.flowerComposition; description = $prod.description; careTips = $prod.careTips }
                        zh = [PSCustomObject]@{ name = $prod.name; flowerComposition = $prod.flowerComposition; description = $prod.description; careTips = $prod.careTips }
                    }) -Force
                }
            }

            $prodJson = $prod | ConvertTo-Json -Depth 10
            [System.IO.File]::WriteAllText($file.FullName, $prodJson, [System.Text.Encoding]::UTF8)
            $allUpdatedProducts += $prod
            Write-Host "  [OK] products/$($file.Name)"
        } catch {
            Write-Host "  [Error] $($file.Name): $_"
        }
    }

    # Cap nhat products.json
    $mktProductsJsonPath = Join-Path $MarketingDir "products.json"
    if ($allUpdatedProducts.Count -gt 0) {
        $allJson = $allUpdatedProducts | ConvertTo-Json -Depth 10
        [System.IO.File]::WriteAllText($mktProductsJsonPath, $allJson, [System.Text.Encoding]::UTF8)
        Write-Host "[OK] products.json -> Dong bo danh sach san pham marketing voi i18n"
    }
}

Write-Host "======================================================================"
Write-Host "HOAN TAT! Cac file branches.json, infoCompany.json... van giu nguyen 100%."
Write-Host "======================================================================"
