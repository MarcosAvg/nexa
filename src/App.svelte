<script lang="ts">
  import { onMount } from "svelte";
import { fade } from "svelte/transition";
  import { AlertCircle, RefreshCcw } from "lucide-svelte";
  import { handleError, initGlobalRealtime } from "./lib/utils";
  import { supabase, auth } from "./lib/supabase";
  import {
    uiState,
    userState,
    personnelState,
    ticketState,
    catalogState,
    historyState,
  } from "./lib/stores";

  import Router from "svelte-spa-router";
  import { routes } from "./lib/routes";
  import MainLayoutWrapper from "./lib/components/MainLayoutWrapper.svelte";
  import LoginView from "./lib/views/LoginView.svelte";
  import { Toaster } from "svelte-sonner";
  import {
    personnelService,
    catalogService,
    ticketService,
    cardService,
    HistoryService,
  } from "./lib/services";
  import GlobalOverlays from "./lib/components/GlobalOverlays.svelte";

  let loadingAuth = $state(true);
  let initError = $state(false);
  // Flag para evitar doble fetch: onAuthStateChange dispara SIGNED_IN justo después
  // de getSession() al inicio, lo que ejecutaría initData dos veces para el mismo usuario.
  let appInitialized = $state(false);

  onMount(async () => {
    // Verificar sesión inicial
    const {
      data: { session: initialSession },
    } = await supabase.auth.getSession();

    if (initialSession) {
      const { data: profile } = await auth.getProfile(initialSession.user.id);
      userState.setProfile(profile);
      await initData();
    }

    loadingAuth = false;
    appInitialized = true;

    // Escuchar cambios de autenticación
    supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (newSession) {
        // Omitir TOKEN_REFRESHED para el mismo usuario — evita thrashing de estado / congelamiento de UI
        if (
          event === "TOKEN_REFRESHED" &&
          userState.profile &&
          userState.profile.id === newSession.user.id
        ) {
          return;
        }

        // Omitir SIGNED_IN redundante que se dispara justo después de getSession() al inicio
        if (
          event === "SIGNED_IN" &&
          appInitialized &&
          userState.profile?.id === newSession.user.id
        ) {
          return;
        }

        const { data: profile } = await auth.getProfile(newSession.user.id);
        userState.setProfile(profile);
        initData(true);
      } else {
        userState.clear();
        // Limpiar userId cache para que el siguiente login no herede usuario anterior
        const { HistoryService } = await import("./lib/services/history");
        HistoryService.clearCache();
      }
    });
  });

  async function initData(isBackground = false) {
    try {
      if (!isBackground) {
        loadingAuth = true;
        initError = false;
      }

      // 1. Critical data for immediate UI (Dashboard / Catalogs)
      // Reemplazado el antiguo personnelService.fetchOptions con uno nuevo eficiente si está disponible
      const [_pOptions, _d, _b, _a, _s] = await Promise.all([
        personnelService.fetchOptions(true),
        catalogService.fetchDependencies(true),
        catalogService.fetchBuildings(true),
        catalogService.fetchAccesses(true),
        catalogService.fetchSchedules(true),
      ]);

      personnelState.setPersonnelOptions(_pOptions);
      catalogState.setDependencies(_d);
      catalogState.setBuildings(_b);
      catalogState.setSpecialAccesses(_a);
      catalogState.setSchedules(_s);

      // 2. Secondary data loaded in background (Non-blocking)
      // Esto permite que la app sea interactiva más rápido
      (async () => {
        try {
          const [_c, _t, _h] = await Promise.all([
            cardService.fetchExtra(true),
            ticketService.fetchAll(true),
            HistoryService.fetchAll(1, 50, {}, true),
          ]);
          personnelState.setCards(_c);
          ticketState.setTickets(_t);
          historyState.setHistory(_h.data, _h.count);

          // Actualizar métricas del dashboard con el nuevo RPC eficiente
          personnelState.refreshDashboardMetrics();

          // Inicializar suscripciones Realtime
          personnelState.initRealtime();
          initGlobalRealtime();
        } catch (e) {
          console.warn("Error loading background data:", e);
        }
      })();
    } catch (err) {
      handleError(err, "Inicializar Aplicación");
      if (!isBackground) {
        initError = true;
      }
    } finally {
      if (!isBackground) {
        loadingAuth = false;
      }
    }
  }

  function retryInit() {
    initData(false);
  }
</script>

<Toaster />

{#if loadingAuth}
  <div class="min-h-screen bg-slate-50 flex items-center justify-center">
    <div class="flex flex-col items-center gap-4">
      <div
        class="w-12 h-12 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin"
      ></div>
      <p class="text-slate-500 font-medium animate-pulse">Cargando Nexa...</p>
    </div>
  </div>
{:else if initError}
  <div class="min-h-screen bg-slate-50 flex items-center justify-center p-4">
    <div class="flex flex-col items-center max-w-sm text-center">
      <div
        class="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-rose-200"
      >
        <AlertCircle size={32} />
      </div>
      <h2 class="text-xl font-bold text-slate-900 mb-2">Error de conexión</h2>
      <p class="text-slate-500 mb-8 text-sm">
        No pudimos cargar los datos iniciales de la aplicación. Por favor,
        verifica tu conexión a internet e inténtalo de nuevo.
      </p>
      <button
        class="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-900/10"
        onclick={retryInit}
      >
        <RefreshCcw size={18} />
        Reintentar conexión
      </button>
    </div>
  </div>
{:else if !userState.profile}
  <LoginView />
{:else}
  <!-- Backdrop global para sidepanel — fuera del MainLayoutWrapper para evitar clipping de backdrop-filter por overflow-hidden -->
  {#if personnelState.isDetailsOpen}
    <div
      class="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
      onclick={() => personnelState.setDetailsOpen(false)}
      role="presentation"
      transition:fade={{ duration: 200 }}
    ></div>
  {/if}

  <MainLayoutWrapper>
    <Router {routes} />
    <GlobalOverlays />
  </MainLayoutWrapper>
{/if}
