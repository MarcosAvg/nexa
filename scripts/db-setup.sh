#!/usr/bin/env bash
# =============================================================================
# db-setup.sh — Bootstrap del esquema de la base de datos (fuente de verdad).
#
# Construye la BD desde `supabase/schemas/**` (definiciones declarativas) y
# aplica `supabase/seed.sql` (datos base de configuración, sin datos de la org).
#
# Usa la CLI de Supabase. Requiere:
#   - `npm install`  (solo si no tienes la CLI global)
#   - `npx supabase --version`  (CLI v2)
#
# Uso:
#   npm run db:setup          # levantar entorno local y reconstruir la BD
#   npm run db:reset          # reconstruir la BD local de nuevo (incluye seed)
#
# Para conectar a una instancia REMOTA (tu propio proyecto Supabase):
#   supabase link --project-ref <TU_PROJECT_REF>
#   supabase db push           # aplica el esquema declarativo al proyecto remoto
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

echo "▶ Comprobando la CLI de Supabase..."
if ! command -v supabase >/dev/null 2>&1; then
  echo "  CLI no encontrada. Usando npx: npx supabase ..."
  SUPABASE="npx supabase"
else
  SUPABASE="supabase"
fi

echo "▶ Iniciando Supabase local (si no está corriendo)..."
if [ "${SUPABASE_LOCAL:-1}" = "1" ]; then
  $SUPABASE start
fi

echo "▶ Reconstruyendo la BD desde supabase/schemas/** + supabase/seed.sql..."
$SUPABASE db reset

echo ""
echo "✔ Base de datos lista."
echo "  - Esquema aplicado desde: supabase/schemas/**"
echo "  - Datos base (config) desde: supabase/seed.sql"
echo ""
echo "  Conecta la app configurando tu .env con la URL/keys de este entorno."
echo "  (Local → http://127.0.0.1:54321  |  keys:  supabase status)"
