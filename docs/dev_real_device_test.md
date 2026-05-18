# HAKAI Real Device Backend Test

This guide helps you test HAKAI from a real Android phone on the same Wi-Fi network as your Windows PC.

## 1. Start the backend

```powershell
cd C:\kuran_app\server
node index.js
```

The backend should print:

- `http://localhost:3000`
- a LAN URL such as `http://192.168.1.42:3000` if one is detected

## 2. Allow Windows Firewall access

Open PowerShell as Administrator and run:

```powershell
powershell -ExecutionPolicy Bypass -File C:\kuran_app\scripts\allow_backend_firewall.ps1
```

This creates an inbound TCP rule named:

- `HAKAI Backend Dev Port 3000`

## 3. Test from the phone browser

On the Android phone, open Chrome or another browser and visit:

```text
http://PC_IP:3000/health
```

You should see JSON like:

```json
{ "ok": true, "service": "hakai-backend" }
```

If that does not load, check:

- the PC and phone are on the same Wi-Fi network
- Windows Firewall is allowing port 3000
- the backend is still running

## 4. Rebuild the APK for the phone

Use the PC's LAN IP when building the APK:

```powershell
flutter build apk --release --dart-define=HAKAI_API_BASE_URL=http://PC_IP:3000
```

Install the resulting APK on the phone and test chat again.
