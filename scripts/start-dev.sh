#!/usr/bin/env bash
set -euo pipefail

echo "🔧 Carregando NVM..."
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1090
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

echo "📦 Instalando Node.js versão 22 (LTS Iron)..."
if ! nvm use lts/iron >/dev/null 2>&1; then
  if ! nvm use 22 >/dev/null 2>&1; then
    nvm install 22
  fi
  nvm use 22
fi

echo "🧩 Verificando .env..."
if [ ! -f .env ]; then
  echo "Sem .env encontrado. Copiando de .env.example"
  cp .env.example .env
fi

echo "📥 Executando npm install..."
npm install

echo "🐳 Subindo Docker (DB/Cache/Queue)..."
docker compose up -d postgres redis rabbitmq

echo "🗂️ Rodando migrações TypeORM..."
npm run migration:run || echo "Nenhuma migração pendente ou TypeORM ainda não configurado."

echo "🚀 Iniciando API (watch)..."
npm run start:api
