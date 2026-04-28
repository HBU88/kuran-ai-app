# Development Workflow

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
When testing from an Android emulator, use:

`http://10.0.2.2:3000/chat`

## Watch live chat logs
```powershell
Get-Content C:\kuran_app\logs\chat_runtime_log.txt -Wait -Tail 40
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
