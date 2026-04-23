# clean.ps1
Write-Host "🧹 Cleaning Next.js cache..." -ForegroundColor Yellow
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Write-Host "✅ Cache cleaned!" -ForegroundColor Green
Write-Host "🚀 Starting dev server..." -ForegroundColor Cyan
npm run dev