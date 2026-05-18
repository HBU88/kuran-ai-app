# HAKAI Development Workflow

## Start the backend
```powershell
cd C:\kuran_app\server
node index.js
```

## Run Flutter
```powershell
cd C:\kuran_app
flutter run
```

## Android emulator backend URL
When testing from an Android emulator, use the default backend URL:

`http://10.0.2.2:3000/chat`

## Real Android phone backend URL
When testing on a physical phone on the same Wi-Fi network, build with the PC's LAN IP:

```powershell
flutter run --dart-define=HAKAI_API_BASE_URL=http://192.168.x.x:3000
```

For release APK testing:

```powershell
flutter build apk --release --dart-define=HAKAI_API_BASE_URL=http://192.168.x.x:3000
```

## Watch live chat logs
```powershell
Get-Content C:\kuran_app\logs\chat_runtime_log.txt -Wait -Tail 40
```

If Turkish characters look corrupted in PowerShell, switch the console output to UTF-8 first:
```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Get-Content C:\kuran_app\logs\chat_runtime_log.txt -Encoding UTF8 -Wait -Tail 40
```

## Use the debug resolve endpoint
When `DEBUG_CHAT_ENGINE=true`:

`http://localhost:3000/debug/resolve?q=haksızlığa%20uğradım`

## Common Troubleshooting

### `EADDRINUSE` on port 3000
Another backend process is already listening on port 3000. Stop the existing process, then restart the server.

### When backend restart is needed
Restart the backend after changes in `server/` or when `/chat` starts failing unexpectedly.

### When Flutter hot restart is enough
Use hot restart for UI-only changes that do not affect backend behavior or app startup state.

### `localhost` vs `10.0.2.2`
- `localhost` is for requests from your host machine.
- `10.0.2.2` is for requests from the Android emulator to reach the host backend.

### `DEBUG_CHAT_ENGINE=true`
Set this only for debug diagnostics. It enables `/debug/resolve` and extra timing detail.
