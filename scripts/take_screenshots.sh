#!/bin/bash
# HAKAI – Gerçek cihazdan App Store ekran görüntüsü
# Çalıştır: bash scripts/take_screenshots.sh

set -e

DEVICE_ID="00008150-001824C82141401C"
API_URL="https://hakai-backend.onrender.com"
OUT_DIR="$HOME/Desktop/hakai_screenshots"
mkdir -p "$OUT_DIR"

# ── screenshot helper ────────────────────────────────────────────────────────
take_ss() {
  local name="$1"
  local file="$OUT_DIR/${name}.png"
  # Xcode 15+ → devicectl
  if xcrun devicectl device screenshot --device "$DEVICE_ID" --output "$file" 2>/dev/null; then
    echo "  ✓ $file"
  # Eski Xcode → idevicescreenshot (brew install libimobiledevice)
  elif command -v idevicescreenshot &>/dev/null; then
    idevicescreenshot -u "$DEVICE_ID" "$file"
    echo "  ✓ $file"
  else
    echo "  ⚠️  Screenshot alınamadı — telefonu kilitsiz tut ve tekrar dene."
  fi
}

# ── Uygulama başlat ──────────────────────────────────────────────────────────
echo "════════════════════════════════════════════"
echo " HAKAI Screenshot Scripti"
echo " Cihaz: $DEVICE_ID"
echo " Çıktı: $OUT_DIR"
echo "════════════════════════════════════════════"
echo ""
echo "📱 Telefon bağlı ve kilitsiz olduğundan emin ol."
echo "🚀 Uygulama başlatılıyor..."
echo ""

cd "$(dirname "$0")/.."
flutter run -d "$DEVICE_ID" \
  --dart-define=HAKAI_API_BASE_URL="$API_URL" \
  --dart-define=DEBUG_DISABLE_USAGE_LIMITS=true \
  &
FLUTTER_PID=$!

echo "⏳ Uygulama yüklensin (25 sn)..."
sleep 25
echo ""

# ── Ekranlar ─────────────────────────────────────────────────────────────────
prompt_and_shoot() {
  local num="$1"
  local label="$2"
  local filename="$3"
  echo "${num}  ${label}"
  echo "   Telefonda bu ekranı aç, sonra Enter'a bas:"
  read -r
  take_ss "$filename"
  echo ""
}

prompt_and_shoot "1️⃣ " "İLMİHAL — bir soru sor ve cevap görünsün" "01_ilmihal"
prompt_and_shoot "2️⃣ " "AYET REHBERİ — güzel bir ayet kartı görünsün" "02_ayet_rehberi"
prompt_and_shoot "3️⃣ " "KIRBLE PUSULASI — hazır/kilitli konumda" "03_kibla"
prompt_and_shoot "4️⃣ " "NAMAZ VAKİTLERİ — şehir seçili, vakitler görünsün" "04_namaz_vakitleri"
prompt_and_shoot "5️⃣ " "DESTEK OL (opsiyonel — atlamak için boş Enter)" "05_destek_ol"

# ── Sonuç ────────────────────────────────────────────────────────────────────
echo "⏹  Flutter durduruluyor..."
kill "$FLUTTER_PID" 2>/dev/null || true

echo ""
echo "════════════════════════════════════════════"
echo " ✅ Tamamlandı!"
echo "════════════════════════════════════════════"
ls "$OUT_DIR"/*.png 2>/dev/null | while read -r f; do
  dims=$(sips -g pixelWidth -g pixelHeight "$f" 2>/dev/null \
    | awk '/pixel/{printf $2"x"}' | sed 's/x$//')
  printf "  %-40s %s px\n" "$(basename "$f")" "$dims"
done
echo ""
echo "📁 $OUT_DIR"
echo ""
echo "⚠️  App Store 6.7\" için 1284x2778 px gerekir."
echo "   Boyut farklıysa simülatör gerekcek — söyle hallederiz."
