<script lang="ts">
  import { onMount } from "svelte";
  import { supabase, auth } from "./lib/supabase";
  // import { appState } from "./lib/state.svelte"; // Deprecated
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
  import LoginView from "./lib/components/LoginView.svelte";
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

  onMount(async () => {
    // Check initial session
    const {
      data: { session: initialSession },
    } = await supabase.auth.getSession();

    if (initialSession) {
      const { data: profile } = await auth.getProfile(initialSession.user.id);
      userState.setProfile(profile);
      await initData();
    }

    loadingAuth = false;

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (newSession) {
        const { data: profile } = await auth.getProfile(newSession.user.id);
        userState.setProfile(profile);
        initData();
      } else {
        userState.clear();
      }
    });
  });

  async function initData() {
    console.log("Iniciando carga de datos desde Supabase...");
    try {
      const [_p, _c, _t, _d, _b, _a, _s, _h] = await Promise.all([
        personnelService.fetchAll(),
        cardService.fetchExtra(),
        ticketService.fetchAll(),
        catalogService.fetchDependencies(),
        catalogService.fetchBuildings(),
        catalogService.fetchAccesses(),
        catalogService.fetchSchedules(),
        HistoryService.fetchAll(),
      ]);

      personnelState.setPersonnel(_p);
      personnelState.setCards(_c);
      ticketState.setTickets(_t);

      catalogState.setDependencies(_d);
      catalogState.setBuildings(_b);
      catalogState.setSpecialAccesses(_a);
      catalogState.setSchedules(_s);

      historyState.setHistory(_h);

      console.log("Carga de datos completada.");
    } catch (err) {
      console.error("Error general en onMount:", err);
    }
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
{:else if !userState.profile}
  <LoginView />
{:else}
  <MainLayoutWrapper>
    <Router {routes} />
    <GlobalOverlays />
  </MainLayoutWrapper>
{/if}
