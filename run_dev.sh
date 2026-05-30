#!/bin/bash
# run_dev.sh — .env'den değişkenleri okuyup flutter run çalıştırır
# Kullanım:
#   ./run_dev.sh                   → varsayılan cihaz
#   ./run_dev.sh simulator         → iOS simulator
#   ./run_dev.sh phone             → gerçek iPhone
#   ./run_dev.sh phone release     → gerçek iPhone, release modu

set -e

ENV_FILE="$(dirname "$0")/server/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ server/.env bulunamadı: $ENV_FILE"
  exit 1
fi

# .env dosyasından değerleri oku (# ile başlayan satırları ve boş satırları atla)
get_env() {
  grep -E "^${1}=" "$ENV_FILE" | head -1 | cut -d '=' -f2- | tr -d '"' | tr -d "'"
}

DIYANET_USER=$(get_env "DIYANET_API_USERNAME")
DIYANET_PASS=$(get_env "DIYANET_API_PASSWORD")
DIYANET_AUTH_URL=$(get_env "DIYANET_AUTH_URL")
OPENAI_KEY=$(get_env "OPENAI_API_KEY")

if [ -z "$DIYANET_USER" ] || [ -z "$DIYANET_PASS" ]; then
  echo "⚠️  server/.env içinde DIYANET_API_USERNAME veya DIYANET_API_PASSWORD bulunamadı"
  echo "   Diyanet olmadan çalışır ama namaz vakitleri fallback kullanır."
fi

# Cihaz seçimi
DEVICE=""
MODE_FLAG=""

case "$1" in
  simulator)
    DEVICE="-d F166179B-EA98-46F1-9FEC-61ADDCE09DFE"
    echo "📱 Hedef: iOS Simulator"
    ;;
  phone)
    DEVICE="-d 00008150-001824C82141401C"
    echo "📱 Hedef: Gerçek iPhone"
    ;;
  *)
    echo "📱 Hedef: Varsayılan cihaz"
    ;;
esac

case "$2" in
  release)
    MODE_FLAG="--release"
    echo "🚀 Mod: release"
    ;;
  *)
    echo "🔧 Mod: debug"
    ;;
esac

# dart-define listesini oluştur
DEFINES=(
  "--dart-define=HAKAI_API_BASE_URL=https://hakai-backend.onrender.com"
  "--dart-define=DEBUG_CHAT_RAW_LOGS=true"
  "--dart-define=DEBUG_DISABLE_USAGE_LIMITS=true"
)

[ -n "$DIYANET_USER" ]     && DEFINES+=("--dart-define=DIYANET_API_USERNAME=${DIYANET_USER}")
[ -n "$DIYANET_PASS" ]     && DEFINES+=("--dart-define=DIYANET_API_PASSWORD=${DIYANET_PASS}")
[ -n "$DIYANET_AUTH_URL" ] && DEFINES+=("--dart-define=DIYANET_AUTH_URL=${DIYANET_AUTH_URL}")

echo ""
echo "▶  flutter run ${DEVICE} ${MODE_FLAG} ${DEFINES[*]}"
echo ""

flutter run $DEVICE $MODE_FLAG "${DEFINES[@]}"
