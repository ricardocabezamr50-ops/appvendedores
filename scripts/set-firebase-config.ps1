# scripts/set-firebase-config.ps1
# Pide los 6 campos de Firebase y escribe firebase.config.json

$ErrorActionPreference = "Stop"
$path = "firebase.config.json"

# Si no existe, crea una base vacía
if (-not (Test-Path $path)) {
  $base = @{
    apiKey = ""
    authDomain = ""
    projectId = ""
    storageBucket = ""
    messagingSenderId = ""
    appId = ""
  }
  ($base | ConvertTo-Json -Depth 3) | Set-Content -Path $path -Encoding UTF8
}

# Lee el JSON actual
$jsonRaw = Get-Content -Path $path -Raw
try {
  $cfg = $jsonRaw | ConvertFrom-Json
} catch {
  Write-Host "El archivo $path no es JSON válido. Lo regenero vacío."
  $cfg = [PSCustomObject]@{
    apiKey = ""
    authDomain = ""
    projectId = ""
    storageBucket = ""
    messagingSenderId = ""
    appId = ""
  }
}

# Asegura claves
foreach ($k in @("apiKey","authDomain","projectId","storageBucket","messagingSenderId","appId")) {
  if ($null -eq $cfg.$k) { $cfg | Add-Member -NotePropertyName $k -NotePropertyValue "" }
}

Write-Host ""
Write-Host "Completá los valores tal como figuran en Firebase Console > Project settings > Your apps (Web app)."
Write-Host "Dejá en blanco para mantener lo actual entre [corchetes]." 

function Ask([string]$key) {
  $curr = [string]$cfg.$key
  if ($curr -eq "") { $curr = "(vacío)" }
  $inp = Read-Host "$key [$curr]"
  if ($inp -ne "") { $cfg.$key = $inp }
}

Ask "apiKey"
Ask "authDomain"
Ask "projectId"
Ask "storageBucket"
Ask "messagingSenderId"
Ask "appId"

# Guarda el JSON
($cfg | ConvertTo-Json -Depth 3) | Set-Content -Path $path -Encoding UTF8
Write-Host ""
Write-Host "Listo. firebase.config.json actualizado:"
Get-Content -Path $path
