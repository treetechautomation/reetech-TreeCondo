#!/bin/bash
# ============================================================
# TreeCondo — Script de Deploy Automático
# Uso: bash deploy.sh [--no-build] [--force]
# ============================================================
set -e

APP_DIR="/var/www/treecondo"
PM2_NAME="treecondo"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()   { echo -e "${GREEN}[deploy]${NC} $1"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $1"; }
error() { echo -e "${RED}[error]${NC} $1"; exit 1; }

cd "$APP_DIR" || error "Diretório $APP_DIR não encontrado"

log "=== TreeCondo Deploy $(date '+%Y-%m-%d %H:%M:%S') ==="

# Pegar versão atual do BUILD_ID antes do deploy
OLD_BUILD=""
if [ -f ".next/BUILD_ID" ]; then
  OLD_BUILD=$(cat .next/BUILD_ID)
fi

# Atualizar código do repositório
if [ "$1" != "--no-build" ]; then
  log "Puxando código mais recente (git pull)..."
  git pull --ff-only || warn "git pull falhou (pode estar sem git configurado, continuando...)"

  log "Instalando dependências (npm ci)..."
  npm ci --prefer-offline 2>/dev/null || npm install

  log "Fazendo build de produção..."
  npm run build || error "Build falhou! Deploy cancelado."

  NEW_BUILD=$(cat .next/BUILD_ID 2>/dev/null || echo "?")
  log "Build concluído: $OLD_BUILD → $NEW_BUILD"
fi

# Recarregar processo PM2 (zero-downtime)
log "Recarregando processo PM2 '$PM2_NAME'..."
if pm2 list | grep -q "$PM2_NAME"; then
  PORT=3008 pm2 reload "$PM2_NAME" --update-env
else
  warn "Processo '$PM2_NAME' não encontrado no PM2. Iniciando..."
  cd "$APP_DIR" && PORT=3008 pm2 start npm --name "$PM2_NAME" -- start -- -p 3008
fi

pm2 save

# Aguardar app subir
log "Aguardando app responder na porta 3008..."
MAX_WAIT=30
COUNT=0
until curl -sf http://127.0.0.1:3008/ > /dev/null 2>&1; do
  sleep 1
  COUNT=$((COUNT + 1))
  if [ $COUNT -ge $MAX_WAIT ]; then
    error "App não respondeu em ${MAX_WAIT}s. Verifique: pm2 logs treecondo"
  fi
done

log "✅ Deploy concluído! App respondendo em http://127.0.0.1:3008"
log "   Status: $(pm2 list | grep $PM2_NAME | awk '{print $10}')"
