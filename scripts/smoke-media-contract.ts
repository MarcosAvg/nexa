/**
 * scripts/smoke-media-contract.ts
 *
 * Verificación (smoke test) del contrato de columnas por medio de `mediaContract`.
 * No pertenece a la app: se ejecuta con `npm run smoke:contract`.
 *
 * Valida que, para un catálogo multi-medio (incluido un medio sin `requires_identifier`),
 * las columnas de ALTAS / MODIFICACIONES / REPOSICIÓN se generen correctamente
 * (omitiendo folio para medios que no usan identificador).
 */

import {
    activeMediaTypes,
    altasMediaCols,
    modifMediaCols,
    reposMediaCols,
} from '../src/lib/utils/mediaContract.ts';

const mediaTypes = [
    { key: 'p2000', name: 'P2000', has_floors: true, requires_identifier: true, requires_responsiva: true, requires_programming: true, active: true },
    { key: 'kone', name: 'KONE', has_floors: true, requires_identifier: true, requires_responsiva: true, requires_programming: true, active: true },
    { key: 'accesspro', name: 'AccessPRO', has_floors: false, requires_identifier: true, requires_responsiva: true, requires_programming: true, active: true },
    // Medio SIN identificador (no usa folio) y SIN pisos:
    { key: 'chip', name: 'Chip Entrada', has_floors: false, requires_identifier: false, requires_responsiva: false, requires_programming: true, active: true },
];

const fail = (msg: string): never => {
    console.error('❌ SMOKE FAIL:', msg);
    process.exit(1);
};

const medias = activeMediaTypes(mediaTypes);
if (medias.length !== 4) fail(`activeMediaTypes: esperado 4 activos, obtuvo ${medias.length}`);
if (medias.find((m) => m.key === 'chip')?.requires_identifier !== false)
    fail('requires_identifier no se propagó para el medio "chip"');

const altas = medias.flatMap((m) => altasMediaCols(m)).map((c) => c.key);
const modif = medias.filter((m) => m.has_floors).flatMap((m) => modifMediaCols(m)).map((c) => c.key);
const repos = medias.flatMap((m) => reposMediaCols(m)).map((c) => c.key);

// ALTAS: medio con pisos -> req + pisos; sin pisos con id -> req + folio; sin id -> solo req
if (!altas.includes('p2000_req') || !altas.includes('pisos_p2000')) fail('ALTAS p2000: faltan req/pisos');
if (!altas.includes('accesspro_req') || !altas.includes('accesspro_folio')) fail('ALTAS accesspro: faltan req/folio');
if (!altas.includes('chip_req')) fail('ALTAS chip: falta req');
if (altas.includes('chip_folio')) fail('ALTAS: no debe incluir folio para medio sin identifier');
if (altas.includes('pisos_chip')) fail('ALTAS chip: no debe incluir pisos (sin pisos)');

// MODIFICACIONES: solo medios con pisos; el medio sin pisos NO genera accion/pisos
if (!modif.includes('accion_p2000') || !modif.includes('pisos_p2000')) fail('MODIF p2000');
if (modif.includes('accion_chip') || modif.includes('pisos_chip')) fail('MODIF: medio sin pisos no debe aparecer');

// REPOSICIÓN: todos; folio solo si requiere identifier
if (!repos.includes('reponer_p2000') || !repos.includes('folio_p2000')) fail('REPOS p2000');
if (!repos.includes('reponer_chip')) fail('REPOS chip: falta reponer');
if (repos.includes('folio_chip')) fail('REPOS: no debe incluir folio para medio sin identifier');
if (!repos.includes('folio_accesspro')) fail('REPOS accesspro: falta folio');

console.log('✅ SMOKE OK — columnas por medio correctas (ALTAS/MOD/REPOS).');
