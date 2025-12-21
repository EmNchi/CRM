# Script pentru a permite accesul în rețea la Next.js Dev Server
# Rulează ca Administrator (Right-click → Run as Administrator)

Write-Host "Adăugare regulă firewall pentru Next.js Dev Server..." -ForegroundColor Yellow

# Adaugă regulă pentru conexiuni entrante pe portul 3000
netsh advfirewall firewall add rule name="Next.js Dev Server (Port 3000)" dir=in action=allow protocol=TCP localport=3000

Write-Host ""
Write-Host "✅ Regulă firewall adăugată cu succes!" -ForegroundColor Green
Write-Host ""
Write-Host "Acum poți accesa aplicația de pe alte dispozitive în rețea:" -ForegroundColor Cyan
Write-Host "http://10.5.0.2:3000" -ForegroundColor White
Write-Host "sau" -ForegroundColor Gray
Write-Host "http://10.180.165.148:3000" -ForegroundColor White
Write-Host ""
Write-Host "Apasă orice tastă pentru a închide..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")



