Write-Host "Emulator starting..."

$emulatorId = "Pixel_6"

flutter emulators --launch $emulatorId

Write-Host "Waiting emulator to boot..."
Start-Sleep -Seconds 15

Write-Host "Getting dependencies..."
flutter pub get

Write-Host "Running app..."
flutter run -d emulator-5554

unction dev {
    powershell -ExecutionPolicy Bypass -File C:\kuran_app\run_dev.ps1
}

function dev {
    powershell -ExecutionPolicy Bypass -File C:\kuran_app\run_dev.ps1
}