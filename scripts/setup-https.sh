#!/usr/bin/env bash
set -euo pipefail

CERT_DIR="certs"
KEY_FILE="$CERT_DIR/lan-key.pem"
CERT_FILE="$CERT_DIR/lan-cert.pem"

if ! command -v mkcert >/dev/null 2>&1; then
  echo "mkcert não encontrado. Instale antes de continuar."
  echo "macOS (Homebrew): brew install mkcert nss"
  echo "Linux (manual): https://github.com/FiloSottile/mkcert"
  exit 1
fi

LAN_IP=""
if command -v ipconfig >/dev/null 2>&1; then
  LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || true)
fi

if [ -z "$LAN_IP" ] && command -v hostname >/dev/null 2>&1; then
  LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi

mkdir -p "$CERT_DIR"

HOSTS=("localhost" "127.0.0.1" "::1")
if [ -n "$LAN_IP" ]; then
  HOSTS+=("$LAN_IP")
fi

mkcert -install
mkcert -key-file "$KEY_FILE" -cert-file "$CERT_FILE" "${HOSTS[@]}"

echo "Certificado gerado em:"
echo "  - $KEY_FILE"
echo "  - $CERT_FILE"

if [ -n "$LAN_IP" ]; then
  echo "URL LAN esperada: https://$LAN_IP:5173"
fi
