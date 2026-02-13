<script lang="ts">
  import { onMount } from "svelte";
  import { supabase, auth } from "./lib/supabase";
  import { personnelService, catalogService } from "./lib/services/personnel";
  import { cardService, ticketService } from "./lib/services/data";
  import { HistoryService } from "./lib/services/history";
  import DashboardLayout from "./lib/components/DashboardLayout.svelte";
  import Button from "./lib/components/Button.svelte";
  import Badge from "./lib/components/Badge.svelte";
  import Card from "./lib/components/Card.svelte";
  import { appState } from "./lib/state.svelte";
  import DashboardView from "./lib/views/DashboardView.svelte";
  import PersonnelView from "./lib/views/PersonnelView.svelte";
  import CardsView from "./lib/views/CardsView.svelte";
  import TicketsView from "./lib/views/TicketsView.svelte";
  import HistoryView from "./lib/views/HistoryView.svelte";
  import Drawer from "./lib/components/Drawer.svelte";
  import Modal from "./lib/components/Modal.svelte";
  import AddTicketModal from "./lib/components/AddTicketModal.svelte";
  import {
    LayoutDashboard,
    Users,
    User,
    Settings,
    CreditCard,
    FileSignature,
    Lock,
    ClipboardList,
    History,
    FileText,
    Trash2,
    Ban,
    RefreshCw,
    UserX,
    CheckCircle2,
  } from "lucide-svelte";

  // ... (Lines 41-232 unchanged) ...

  // Data variables are now in appState
  let {
    personnel,
    extraCards,
    pendingItems,
    dependencies,
    buildings,
    specialAccesses,
    schedules,
  } = $derived(appState);

  import SettingsView from "./lib/components/SettingsView.svelte";
  import ApproveChangeModal from "./lib/components/ApproveChangeModal.svelte";
  import { Toaster } from "svelte-sonner";

  // Current User for Sidebar
  // Current User based on session and userProfile
  const currentUser = $derived.by(() => {
    if (!session?.user) return null;
    return {
      id: session.user.id,
      name: appState.userProfile?.full_name || "Usuario",
      email: session.user.email,
      role: appState.userProfile?.role || "viewer",
      avatar: session.user.user_metadata?.avatar_url,
    };
  });

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  // Icons
  const sidebarItems = [
    { label: "Dashboard", href: "#", icon: LayoutDashboard },
    { label: "Personal", href: "#", icon: Users },
    { label: "Tarjetas", href: "#", icon: CreditCard },
    { label: "Pendientes", href: "#", icon: ClipboardList },
    { label: "Historial", href: "#", icon: History },
    { label: "Configuración", href: "#", icon: Settings },
  ];

  // Drawer state
  let isDrawerOpen = $state(false);
  let drawerMode = $state<"create" | "edit">("create");
  let selectedUser = $state<any>(null);

  function openCreateDrawer() {
    drawerMode = "create";
    selectedUser = null;
    isDrawerOpen = true;
  }

  function openEditDrawer(user: any) {
    drawerMode = "edit";
    selectedUser = user;
    isDrawerOpen = true;
  }

  function saveUser() {
    // Implement save logic here
    isDrawerOpen = false;
  }
  import FilterGroup from "./lib/components/FilterGroup.svelte";
  import FilterSelect from "./lib/components/FilterSelect.svelte";
  import SectionHeader from "./lib/components/SectionHeader.svelte";
  import AddPersonModal from "./lib/components/AddPersonModal.svelte";
  import AddCardModal from "./lib/components/AddCardModal.svelte";
  import PersonDetailsPanel from "./lib/components/PersonDetailsPanel.svelte";
  import ReplaceCardModal from "./lib/components/ReplaceCardModal.svelte";

  // Filter states
  let statusFilter = $state("Todos");
  let dependencyFilter = $state("");
  import LoginView from "./lib/components/LoginView.svelte";

  // --- UI/State management ---
  let activeTab = $state("dashboard"); // dashboard, tickets, cards, settings
  let sidebarOpen = $state(true);
  let session = $state<any>(null);
  let loadingAuth = $state(true);

  // Pagination current page
  let currentPage = $state(1);
  let personSearch = $state("");

  // Card Filter states
  let cardStatusFilter = $state("Todas");
  let cardSearch = $state("");

  // Ticket Filter State
  let ticketFilter = $state("Todos");

  // Modal states
  let isAddPersonModalOpen = $state(false);
  let isAddCardModalOpen = $state(false);
  let isAddTicketModalOpen = $state(false);
  let isBlockCardModalOpen = $state(false);
  let isUnassignCardModalOpen = $state(false);
  let isReplaceCardModalOpen = $state(false);
  let isDeleteCardModalOpen = $state(false);
  let isApproveChangeModalOpen = $state(false);

  let isBlockPersonModalOpen = $state(false);
  let isDeactivatePersonModalOpen = $state(false);
  let isReactivatePersonModalOpen = $state(false);
  let isPermanentDeletePersonModalOpen = $state(false);

  // Ticket Confirmations
  let isConfirmSignModalOpen = $state(false);
  let isConfirmProgModalOpen = $state(false);
  let isCompleteTicketModalOpen = $state(false);
  let isTicketOptionsModalOpen = $state(false);
  let shouldRestoreTicketModal = $state(false);

  // Restore ticket modal after side panel closes
  $effect(() => {
    if (!isDetailsPanelOpen && shouldRestoreTicketModal && selectedTicket) {
      isTicketOptionsModalOpen = true;
      shouldRestoreTicketModal = false;
    }
  });

  let isSuccessModalOpen = $state(false);
  let successData = $state({ title: "", message: "" });

  function showSuccess(title: string, message: string) {
    successData = { title, message };
    isSuccessModalOpen = true;
  }

  // Side panel states
  let isDetailsPanelOpen = $state(false);
  let selectedPerson = $state<any>(null);
  let personToEdit = $state<any>(null);
  let selectedCard = $state<any>(null);
  let selectedTicket = $state<any>(null);

  // Extra cards state (cards not assigned to personnel)

  // --- Remote Data Fetching ---
  onMount(async () => {
    // Check initial session
    const {
      data: { session: initialSession },
    } = await supabase.auth.getSession();
    session = initialSession;

    if (session) {
      const { data: profile } = await auth.getProfile(session.user.id);
      appState.userProfile = profile;
      await initData();
    }

    loadingAuth = false;

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, newSession) => {
      session = newSession;
      if (session) {
        const { data: profile } = await auth.getProfile(session.user.id);
        appState.userProfile = profile;
        initData();
      } else {
        appState.userProfile = null;
      }
    });
  });

  async function initData() {
    console.log("Iniciando carga de datos desde Supabase...");
    try {
      const [_p, _c, _t, _d, _b, _a, _s] = await Promise.all([
        personnelService.fetchAll(),
        cardService.fetchExtra(),
        ticketService.fetchAll(),
        catalogService.fetchDependencies(),
        catalogService.fetchBuildings(),
        catalogService.fetchAccesses(),
        catalogService.fetchSchedules(),
        catalogService.fetchSchedules(),
        fetchHistory(),
        ticketService.syncSystemTickets(), // Ensure system tickets exist
      ]);

      appState.setData("personnel", _p);
      appState.setData("extraCards", _c);
      appState.setData("pendingItems", _t);
      appState.setData("dependencies", _d);
      appState.setData("buildings", _b);
      appState.setData("specialAccesses", _a);
      appState.setData("schedules", _s);

      console.log("Carga de datos completada.");
    } catch (err) {
      console.error("Error general en onMount:", err);
    }
  }

  async function fetchHistory() {
    try {
      const data = await HistoryService.fetchAll();
      // No mapping needed for now, HistoryView handles the raw fields
      appState.setData("filteredHistoryLogs", data);
    } catch (e) {
      console.error("Error fetching history", e);
      // Initialize with empty if error to prevent UI issues
      appState.setData("filteredHistoryLogs", []);
    }
  }

  // Computed Cards Data
  let allCards = $derived.by(() => {
    const cards: any[] = [];
    // Extract cards from personnel
    personnel.forEach((person) => {
      if (person.cards) {
        person.cards.forEach((card: any) => {
          cards.push({
            ...card,
            id: card.id,
            personId: person.id,
            personName: person.name,
            personStatus: person.status,
          });
        });
      }
    });
    // Add extra cards
    cards.push(
      ...extraCards.map((c) => ({
        ...c,
        id: c.id,
        personName: "Sin asignar",
      })),
    );

    // Apply Status Filter
    let result = cards;
    if (cardStatusFilter !== "Todas") {
      if (cardStatusFilter === "Activa")
        result = result.filter((c) => c.status === "active");
      else if (cardStatusFilter === "Bloqueada")
        result = result.filter((c) => c.status === "blocked");
      else if (cardStatusFilter === "Baja" || cardStatusFilter === "Disponible")
        result = result.filter((c) => c.status === "available");
    }

    // Apply Text Search Filter (Folio or Person Name)
    if (cardSearch.trim() !== "") {
      const search = cardSearch.toLowerCase();
      result = result.filter(
        (c) =>
          c.folio.toLowerCase().includes(search) ||
          c.personName.toLowerCase().includes(search),
      );
    }

    return result;
  });

  let isProcessing = $state(false);

  // Computed Tickets Data
  let filteredTickets = $derived.by(() => {
    if (ticketFilter === "Todos") return pendingItems;
    if (ticketFilter === "Programación")
      return pendingItems.filter((t: any) => t.type === "Programación");
    if (ticketFilter === "Firmas")
      return pendingItems.filter((t: any) => t.type === "Firma Responsiva");
    if (ticketFilter === "Cobros")
      return pendingItems.filter((t: any) => t.type === "Cobro");
    if (ticketFilter === "P2000")
      return pendingItems.filter((t: any) => t.cardType === "P2000");
    if (ticketFilter === "KONE")
      return pendingItems.filter((t: any) => t.cardType === "KONE");
    return pendingItems;
  });

  // Computed Personnel Data
  let filteredPersonnel = $derived.by(() => {
    return personnel.filter((person) => {
      const matchStatus =
        statusFilter === "Todos" ||
        (statusFilter === "Activo/a" && person.status === "Activo/a") ||
        (statusFilter === "Inactivo/a" && person.status === "Inactivo/a") ||
        (statusFilter === "Bloqueado/a" && person.status === "Bloqueado/a") ||
        (statusFilter === "Baja" && person.status === "Baja");

      const matchDependency =
        dependencyFilter === "" || person.dependency === dependencyFilter;
      const matchSearch =
        personSearch === "" ||
        person.name.toLowerCase().includes(personSearch.toLowerCase());

      return matchStatus && matchDependency && matchSearch;
    });
  });

  async function handleNewPersonSave(data: any) {
    if (isProcessing) return;
    isProcessing = true;
    try {
      await personnelService.save(data);

      const action = data.id ? "Actualizar Persona" : "Crear Persona";
      const details = data.id
        ? `Datos actualizados para ${data.first_name} ${data.last_name}`
        : `Nueva persona registrada: ${data.first_name} ${data.last_name}`;

      await initData();
      showSuccess(
        "Personal Actualizado",
        "Los datos del personal han sido guardados correctamente.",
      );
      isAddPersonModalOpen = false;
    } catch (e) {
      console.error("Error saving person", e);
    } finally {
      isProcessing = false;
    }
  }

  function handleEditPerson(person: any) {
    shouldRestoreTicketModal = false; // Prevent ticket modal from coming back
    personToEdit = person;
    isDetailsPanelOpen = false; // Close side panel
    isAddPersonModalOpen = true;
  }

  function handleBlockPerson(person: any) {
    selectedPerson = person;
    isBlockPersonModalOpen = true;
  }

  async function confirmBlockPerson() {
    if (selectedPerson && !isProcessing) {
      isProcessing = true;
      const newStatus =
        selectedPerson.status === "Bloqueado/a" ? "active" : "blocked";

      try {
        await personnelService.updateStatus(selectedPerson.id, newStatus);

        await HistoryService.log(
          "PERSONNEL",
          selectedPerson.id,
          newStatus === "active" ? "ACTIVATE" : "BLOCK",
          {
            message: `Estado de ${selectedPerson.name} cambiado a ${newStatus}`,
          },
        );

        await initData();
        // Refresh selected person
        const p = personnel.find((p) => p.id === selectedPerson.id);
        if (p) selectedPerson = p;
        showSuccess(
          newStatus === "active" ? "Persona Desbloqueada" : "Persona Bloqueada",
          `El estado de ${selectedPerson.name} ha sido actualizado.`,
        );
        isBlockPersonModalOpen = false;
      } catch (e) {
        console.error("Error blocking person", e);
      } finally {
        isProcessing = false;
      }
    }
  }

  function handleDeactivatePerson(person: any) {
    selectedPerson = person;
    isDeactivatePersonModalOpen = true;
  }

  function handleReactivatePerson(person: any) {
    selectedPerson = person;
    isReactivatePersonModalOpen = true;
  }

  function handleDeletePermanentPerson(person: any) {
    selectedPerson = person;
    isPermanentDeletePersonModalOpen = true;
  }

  async function confirmDeactivatePerson() {
    if (selectedPerson && !isProcessing) {
      isProcessing = true;
      try {
        const name = selectedPerson.name;
        await personnelService.updateStatus(selectedPerson.id, "inactive");

        await initData();
        // Refresh selected person to reflect "Baja" status in the UI
        const p = (appState.personnel as any[]).find(
          (p) => p.id === selectedPerson.id,
        );
        if (p) selectedPerson = p;

        showSuccess(
          "Baja Confirmada",
          `${name} ha sido dado de baja del sistema.`,
        );
        isDeactivatePersonModalOpen = false;
      } catch (e) {
        console.error("Error deactivating person", e);
      } finally {
        isProcessing = false;
      }
    }
  }

  async function confirmReactivatePerson() {
    if (selectedPerson && !isProcessing) {
      isProcessing = true;
      try {
        await personnelService.updateStatus(selectedPerson.id, "active");

        showSuccess(
          "Personal Reactivado",
          `${selectedPerson.name} ha sido reactivado/a correctamente.`,
        );
        await initData();
        // Refresh selected person
        const p = (appState.personnel as any[]).find(
          (p) => p.id === selectedPerson.id,
        );
        if (p) selectedPerson = p;
        isReactivatePersonModalOpen = false;
      } catch (e) {
        console.error("Error reactivating person:", e);
      } finally {
        isProcessing = false;
      }
    }
  }

  async function confirmPermanentDeletePerson() {
    if (selectedPerson && !isProcessing) {
      isProcessing = true;
      try {
        await personnelService.delete(selectedPerson.id);

        showSuccess(
          "Registro Eliminado",
          "El registro ha sido eliminado permanentemente de la base de datos.",
        );
        isDetailsPanelOpen = false;
        isPermanentDeletePersonModalOpen = false;
        selectedPerson = null;
        await initData();
      } catch (e) {
        console.error("Error deleting person:", e);
      } finally {
        isProcessing = false;
      }
    }
  }

  async function handleNewCardSave(data: any) {
    if (isProcessing) return;
    isProcessing = true;
    try {
      // If we have a selected person and the details panel is open, assign it
      const assignToId =
        isDetailsPanelOpen && selectedPerson ? selectedPerson.id : null;

      await cardService.save({
        ...data,
        person_id: assignToId,
      });

      const action = assignToId
        ? "Asignación de Tarjeta"
        : "Registro de Tarjeta";
      const details = assignToId
        ? `Tarjeta ${data.folio} (${data.type}) asignada a ${selectedPerson.name}`
        : `Tarjeta ${data.folio} (${data.type}) registrada en inventario`;

      await initData();

      // Feedback
      const message = assignToId
        ? `La tarjeta folio ${data.folio} ha sido registrada y asignada a ${selectedPerson.name}.`
        : `La tarjeta folio ${data.folio} ha sido registrada.`;

      showSuccess("Tarjeta Agregada", message);

      // Refresh selected person to show the new card in the panel
      if (assignToId) {
        const p = personnel.find((p) => p.id === assignToId);
        if (p) selectedPerson = p;
      }

      isAddCardModalOpen = false;
    } catch (e) {
      console.error("Error saving card", e);
    } finally {
      isProcessing = false;
    }
  }

  function handleCardAddFromPanel() {
    isAddCardModalOpen = true;
  }

  function openPersonDetails(person: any) {
    selectedPerson = person;
    isDetailsPanelOpen = true;
  }

  // Card Actions
  function handleViewCardPerson(card: any) {
    if (!card.personId) return;
    const person = personnel.find((p) => p.id === card.personId);
    if (person) {
      openPersonDetails(person);
    }
  }

  function handleBlockCard(card: any) {
    selectedCard = card;
    isBlockCardModalOpen = true;
  }

  function handleUnassignCard(card: any) {
    selectedCard = card;
    isUnassignCardModalOpen = true;
  }

  function handleReplaceCard(card: any) {
    selectedCard = card;
    if (
      card.personId &&
      (!selectedPerson || selectedPerson.id !== card.personId)
    ) {
      const person = personnel.find((p) => p.id === card.personId);
      if (person) selectedPerson = person;
    }
    isReplaceCardModalOpen = true;
  }

  function handleDeleteCard(card: any) {
    selectedCard = card;
    isDeleteCardModalOpen = true;
  }

  async function confirmBlockCard() {
    if (selectedCard && !isProcessing) {
      isProcessing = true;
      const isReactivating =
        selectedCard.status === "blocked" || selectedCard.status === "inactive";
      const newStatus = isReactivating ? "active" : "blocked";
      try {
        await cardService.updateStatus(selectedCard.id, newStatus);

        await initData();
        // Update selectedPerson if panel is open
        if (selectedPerson) {
          const p = personnel.find((p) => p.id === selectedPerson.id);
          if (p) selectedPerson = p;
        }
        showSuccess(
          isReactivating ? "Tarjeta Activada" : "Tarjeta Bloqueada",
          `La tarjeta ${selectedCard.folio} ha sido actualizada.`,
        );
        isBlockCardModalOpen = false;
      } catch (e) {
        console.error("Error updating card status", e);
      } finally {
        isProcessing = false;
      }
    }
    selectedCard = null;
  }

  async function handleReactivateCard(card: any) {
    selectedCard = card;
    // We can reuse the block card modal or logic if we want, but usually it's a direct action or a confirmation
    // Let's just use confirmBlockCard logic but maybe with a different modal if needed.
    // Actually, confirmation for reactivation is good. Let's reuse isBlockCardModalOpen but with dynamic title.
    isBlockCardModalOpen = true;
  }

  async function confirmUnassignCard() {
    if (selectedCard && !isProcessing) {
      isProcessing = true;
      try {
        await cardService.unassign(selectedCard.id);

        await initData();
        if (selectedPerson) {
          const p = personnel.find((p) => p.id === selectedPerson.id);
          if (p) selectedPerson = p;
        }
        showSuccess(
          "Tarjeta Desvinculada",
          `La tarjeta ${selectedCard.folio} ahora está disponible en el inventario.`,
        );
        isUnassignCardModalOpen = false;
      } catch (e) {
        console.error("Error unassigning card", e);
      } finally {
        isProcessing = false;
      }
    }
    selectedCard = null;
  }

  async function confirmReplaceCard(
    newCard: { type: string; folio: string },
    deleteOld: boolean,
  ) {
    if (selectedCard && selectedPerson && !isProcessing) {
      isProcessing = true;
      try {
        const oldCardId = selectedCard.id;
        const personId = selectedPerson.id;

        // 1. Handle old card (Unassign or Delete)
        if (deleteOld) {
          await cardService.delete(oldCardId);
        } else {
          await cardService.unassign(oldCardId);
        }

        // 2. Assign/Create new card using the service (handles tickets and state)
        await cardService.save({
          folio: newCard.folio,
          type: newCard.type,
          person_id: personId,
          // Force reset to ensure new tickets are created
          responsiva_status: "unsigned",
          programming_status: "pending",
        });

        await initData();

        await HistoryService.log("PERSONNEL", personId, "REPLACE_CARD", {
          message: `Tarjeta anterior ${selectedCard.folio} reemplazada por ${newCard.folio}. Anterior ${deleteOld ? "eliminada" : "desvinculada"}.`,
        });

        // Refresh selected person
        const p = personnel.find((p) => p.id === personId);
        if (p) selectedPerson = p;

        showSuccess(
          "Reposición Completada",
          `Se ha asignado la nueva tarjeta ${newCard.folio} a ${p?.name || "la persona"}.`,
        );
      } catch (e) {
        console.error("Error in card replacement flow", e);
      } finally {
        isProcessing = false;
      }
    }
    selectedCard = null;
  }

  async function confirmDeleteCard() {
    if (selectedCard && !isProcessing) {
      isProcessing = true;
      try {
        const folio = selectedCard.folio;
        const isPermanent = selectedCard.status === "inactive";

        if (isPermanent) {
          await cardService.delete(selectedCard.id);
          showSuccess(
            "Tarjeta Eliminada",
            `La tarjeta ${folio} ha sido borrada permanentemente del sistema.`,
          );
        } else {
          await cardService.deactivate(selectedCard.id);
          showSuccess(
            "Baja de Tarjeta",
            `La tarjeta ${folio} ha sido dada de baja del sistema. Estará disponible para reactivación o eliminación permanente.`,
          );
        }

        await initData();
        if (selectedPerson) {
          const p = personnel.find((p) => p.id === selectedPerson.id);
          if (p) selectedPerson = p;
        }
        isDeleteCardModalOpen = false;
      } catch (e) {
        console.error("Error deleting card", e);
      } finally {
        isProcessing = false;
      }
    }
    selectedCard = null;
  }

  // Ticket Actions
  // Ticket Actions
  function handleManageTicket(ticket: any) {
    console.log("Manage ticket:", ticket);
    selectedTicket = ticket;

    // Real Ticket logic (Now ALL tickets are real)
    if (ticket.type === "Firma Responsiva") {
      // Find the person associated with this ticket
      const person = personnel.find((p) => p.id === ticket.person_id);
      if (person) {
        openPersonDetails(person);
      } else {
        // Fallback for safety
        isConfirmSignModalOpen = true;
      }
    } else if (
      ticket.type === "Modificación de Datos" ||
      ticket.type === "Programación de Acceso"
    ) {
      // Check if Programación
      if (ticket.type === "Programación de Acceso") {
        // ticket.actionType === 'program' ?
        // The title in DB is "Programación de Acceso". The type was "Programación" in virtual?
        // Let's check ensureSystemTicket calls.
        // ensureSystemTicket(..., "Programación de Acceso", "Programación de Acceso", ...)
        // So type is "Programación de Acceso".
        isConfirmProgModalOpen = true;
      } else {
        isApproveChangeModalOpen = true;
      }
    } else {
      // For manual tickets, show options modal
      isTicketOptionsModalOpen = true;
    }
  }

  async function confirmRejectTicket() {
    if (selectedTicket && !isProcessing) {
      isProcessing = true;
      try {
        const title = selectedTicket.title;
        // Only real tickets can be literally deleted
        await ticketService.delete(selectedTicket.id);
        await initData();
        showSuccess(
          "Ticket Rechazado",
          `La tarea "${title}" ha sido descartada.`,
        );
        isTicketOptionsModalOpen = false;
      } catch (e) {
        console.error("Error rejecting ticket", e);
      } finally {
        isProcessing = false;
      }
    }
    selectedTicket = null;
  }

  async function confirmCompleteTicket() {
    if (selectedTicket && !isProcessing) {
      isProcessing = true;
      try {
        const title = selectedTicket.title;
        // Check if virtual
        await ticketService.updateStatus(selectedTicket.id, "completed");

        await initData();
        showSuccess(
          "Ticket Completado",
          `La tarea "${title}" ha sido marcada como finalizada.`,
        );
        isCompleteTicketModalOpen = false;
      } catch (e) {
        console.error("Error completing ticket", e);
      } finally {
        isProcessing = false;
      }
    }
    selectedTicket = null;
  }

  async function confirmSignTicket() {
    if (selectedTicket && selectedTicket.card_id && !isProcessing) {
      isProcessing = true;
      try {
        await cardService.updateResponsivaStatus(
          selectedTicket.card_id,
          "signed",
        );
        await initData();
        showSuccess(
          "Firma Registrada",
          `La responsiva para ${selectedTicket.cardFolio} ha sido marcada como firmada.`,
        );
      } catch (e) {
        console.error("Error signing ticket", e);
      } finally {
        isProcessing = false;
        isConfirmSignModalOpen = false;
        selectedTicket = null;
      }
    }
  }

  async function confirmProgTicket() {
    if (selectedTicket && selectedTicket.card_id && !isProcessing) {
      isProcessing = true;
      try {
        await cardService.updateProgrammingStatus(
          selectedTicket.card_id,
          "done",
        );
        await initData();
        showSuccess(
          "Programación Completada",
          `El acceso para ${selectedTicket.cardFolio} ha sido configurado correctamente.`,
        );
      } catch (e) {
        console.error("Error programming ticket", e);
      } finally {
        isProcessing = false;
        isConfirmProgModalOpen = false;
        selectedTicket = null;
      }
    }
  }

  // Side Panel Card Actions ARE NOW CENTRALIZED
</script>

{#if loadingAuth}
  <div class="min-h-screen bg-slate-50 flex items-center justify-center">
    <div class="flex flex-col items-center gap-4">
      <div
        class="w-12 h-12 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin"
      ></div>
      <p class="text-slate-500 font-medium animate-pulse">Cargando Nexa...</p>
    </div>
  </div>
{:else if !session}
  <LoginView />
{:else}
  <DashboardLayout
    {sidebarItems}
    user={currentUser || undefined}
    onLogout={handleLogout}
  >
    {#snippet headerTitle()}
      {#if appState.activePage === "Personal"}
        Gestion de personal
      {:else if appState.activePage === "Tarjetas"}
        Gestión de tarjetas
      {:else}
        {appState.activePage}
      {/if}
    {/snippet}
    <div class="space-y-8">
      {#if appState.activePage === "Dashboard"}
        <DashboardView
          onOpenAddPerson={() => (isAddPersonModalOpen = true)}
          onOpenAddTicket={() => (isAddTicketModalOpen = true)}
          onOpenAddCard={() => (isAddCardModalOpen = true)}
          {currentUser}
        />
      {:else if appState.activePage === "Personal"}
        <PersonnelView
          onOpenAddModal={() => (isAddPersonModalOpen = true)}
          onOpenDetails={openPersonDetails}
          {currentUser}
        />
      {:else if appState.activePage === "Tarjetas"}
        <CardsView
          onOpenAddCard={() => (isAddCardModalOpen = true)}
          onBlockCard={handleBlockCard}
          onUnassignCard={handleUnassignCard}
          onReplaceCard={handleReplaceCard}
          onDeleteCard={handleDeleteCard}
          onViewPerson={handleViewCardPerson}
          {currentUser}
        />
      {:else if appState.activePage === "Pendientes"}
        <TicketsView
          onManageTicket={handleManageTicket}
          onOpenAddTicket={() => (isAddTicketModalOpen = true)}
          {personnel}
          onRefresh={initData}
          {currentUser}
          {dependencies}
        />
      {:else if appState.activePage === "Historial"}
        <HistoryView />
      {:else if appState.activePage === "Configuración"}
        <SettingsView {currentUser} />
      {/if}
    </div>
  </DashboardLayout>
{/if}

<!-- Add Person Modal -->
<AddPersonModal
  bind:isOpen={isAddPersonModalOpen}
  {buildings}
  {dependencies}
  {specialAccesses}
  {schedules}
  availableCards={extraCards}
  initialData={personToEdit}
  onSave={handleNewPersonSave}
  onSuccess={initData}
  onclose={() => {
    if (personToEdit) {
      // We were editing, so re-open the panel for the updated (or original) person
      // Find the person again in case it was updated
      const person = personnel.find((p) => p.id === personToEdit.id);
      if (person) {
        selectedPerson = person;
        isDetailsPanelOpen = true;
      }
      personToEdit = null;
    }
  }}
/>

<!-- Add Card Modal -->
<AddCardModal
  bind:isOpen={isAddCardModalOpen}
  availableCards={extraCards}
  onSave={handleNewCardSave}
/>

<!-- Person Details Side Panel -->
<PersonDetailsPanel
  bind:isOpen={isDetailsPanelOpen}
  person={selectedPerson}
  onEdit={handleEditPerson}
  onBlock={handleBlockPerson}
  onDeactivate={handleDeactivatePerson}
  onCardBlock={handleBlockCard}
  onCardUnassign={handleUnassignCard}
  onCardReplace={handleReplaceCard}
  onCardAdd={handleCardAddFromPanel}
  onReactivate={handleReactivatePerson}
  onDeletePermanent={handleDeletePermanentPerson}
  onRefresh={async () => {
    await initData();
    // Update selectedPerson reference to show new data (responsiva status)
    if (selectedPerson) {
      selectedPerson =
        personnel.find((p) => p.id === selectedPerson.id) || null;
    }
  }}
/>

<!-- Add Ticket Modal -->
<AddTicketModal
  bind:isOpen={isAddTicketModalOpen}
  {personnel}
  {currentUser}
  {dependencies}
  onSave={initData}
/>

<!-- Replace Card Modal -->
<ReplaceCardModal
  bind:isOpen={isReplaceCardModalOpen}
  oldCard={selectedCard}
  availableCards={extraCards}
  onConfirm={confirmReplaceCard}
  onclose={() => (selectedCard = null)}
  loading={isProcessing}
/>

<!-- Block Card Confirmation Modal -->
<Modal
  bind:isOpen={isBlockCardModalOpen}
  title={selectedCard?.status === "blocked"
    ? "Desbloquear Tarjeta"
    : "Bloquear Tarjeta"}
  description={selectedCard?.status === "blocked"
    ? `¿Deseas restaurar el acceso para la tarjeta ${selectedCard?.folio}?`
    : `¿Estás seguro de que deseas bloquear la tarjeta ${selectedCard?.folio}?`}
  size="sm"
>
  <div class="p-4 bg-amber-50 rounded-xl border border-amber-100 mb-4">
    <div class="flex gap-3">
      <div class="mt-0.5 text-amber-600">
        <Lock size={20} />
      </div>
      <div>
        <h4 class="text-sm font-bold text-amber-900">
          {selectedCard?.status === "blocked"
            ? "Restaurar acceso"
            : "Confirmar bloqueo"}
        </h4>
        <p class="text-sm text-amber-800 mt-1">
          {selectedCard?.status === "blocked"
            ? "La tarjeta volverá a funcionar en todos los accesos autorizados inmediatamente."
            : "La tarjeta quedará inactiva y no permitirá el acceso hasta que sea desbloqueada manualmente."}
        </p>
      </div>
    </div>
  </div>

  {#snippet footer()}
    <Button variant="secondary" onclick={() => (isBlockCardModalOpen = false)}
      >Cancelar</Button
    >
    <Button variant="primary" onclick={confirmBlockCard} loading={isProcessing}>
      {selectedCard?.status === "blocked"
        ? "Confirmar Desbloqueo"
        : "Confirmar Bloqueo"}
    </Button>
  {/snippet}
</Modal>

<!-- Delete Card Confirmation Modal -->
<Modal
  bind:isOpen={isDeleteCardModalOpen}
  title={selectedCard?.status === "inactive"
    ? "Eliminación Permanente"
    : "Dar de Baja Tarjeta"}
  description={selectedCard?.status === "inactive"
    ? `¿Estás seguro de que deseas eliminar la tarjeta ${selectedCard?.folio} permanentemente? Esta acción es irreversible.`
    : `¿Deseas dar de baja la tarjeta ${selectedCard?.folio}? Dejará de estar vinculada a cualquier persona.`}
  size="sm"
>
  <div class="p-4 bg-rose-50 rounded-xl border border-rose-100 mb-4">
    <div class="flex gap-3">
      <div class="mt-0.5 text-rose-600">
        <Trash2 size={20} />
      </div>
      <div>
        <h4 class="text-sm font-bold text-rose-900">
          {selectedCard?.status === "inactive"
            ? "Acción irreversible"
            : "Baja de inventario"}
        </h4>
        <p class="text-sm text-rose-800 mt-1">
          {selectedCard?.status === "inactive"
            ? "Esta acción eliminará la tarjeta del sistema permanentemente. No se podrá recuperar."
            : "La tarjeta se moverá al estado de 'Baja'. Podrás reactivarla más tarde o eliminarla definitivamente."}
        </p>
      </div>
    </div>
  </div>

  {#snippet footer()}
    <Button variant="secondary" onclick={() => (isDeleteCardModalOpen = false)}
      >Cancelar</Button
    >
    <Button variant="danger" onclick={confirmDeleteCard} loading={isProcessing}>
      {selectedCard?.status === "inactive"
        ? "Eliminar para siempre"
        : "Confirmar Baja"}
    </Button>
  {/snippet}
</Modal>

<!-- Unassign Card Confirmation Modal -->
<Modal
  bind:isOpen={isUnassignCardModalOpen}
  title="Desvincular Tarjeta"
  description={`¿Estás seguro de desvincular la tarjeta ${selectedCard?.folio}?`}
  size="sm"
>
  <div class="p-4 bg-rose-50 rounded-xl border border-rose-100 mb-4">
    <div class="flex gap-3">
      <div class="mt-0.5 text-rose-600">
        <Ban size={20} />
      </div>
      <div>
        <h4 class="text-sm font-bold text-rose-900">
          Confirmar desvinculación
        </h4>
        <p class="text-sm text-rose-800 mt-1">
          La tarjeta dejará de pertenecer a la persona y volverá al inventario
          general como "Disponible".
        </p>
      </div>
    </div>
  </div>

  {#snippet footer()}
    <Button
      variant="secondary"
      onclick={() => (isUnassignCardModalOpen = false)}>Cancelar</Button
    >
    <Button
      variant="danger"
      onclick={confirmUnassignCard}
      loading={isProcessing}>Confirmar Desvinculación</Button
    >
  {/snippet}
</Modal>

<!-- Complete Ticket Modal -->
<Modal
  bind:isOpen={isCompleteTicketModalOpen}
  title="Completar Ticket"
  description="Confirma que has completado la tarea solicitada."
>
  <div class="space-y-4">
    <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
      <h4 class="font-bold text-slate-900">{selectedTicket?.title}</h4>
      <p class="text-sm text-slate-600 mt-1">{selectedTicket?.description}</p>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <span class="text-xs text-slate-500 font-bold uppercase">Persona</span>
        <p class="font-medium text-slate-900">{selectedTicket?.personName}</p>
      </div>
      <div>
        <span class="text-xs text-slate-500 font-bold uppercase">Tarjeta</span>
        <p class="font-medium text-slate-900">
          {selectedTicket?.cardType} - {selectedTicket?.cardFolio}
        </p>
      </div>
    </div>
  </div>

  {#snippet footer()}
    <Button
      variant="secondary"
      onclick={() => (isCompleteTicketModalOpen = false)}>Cancelar</Button
    >
    <Button
      variant="success"
      onclick={confirmCompleteTicket}
      loading={isProcessing}
      disabled={currentUser?.role !== "admin"}
    >
      {currentUser?.role === "admin"
        ? "Marcar como Completado"
        : "Solo Administradores"}
    </Button>
  {/snippet}
</Modal>
<!-- Block Person Confirmation Modal -->
<Modal
  bind:isOpen={isBlockPersonModalOpen}
  title={selectedPerson?.status === "blocked" ||
  selectedPerson?.status === "Bloqueado/a"
    ? "Desbloquear Persona"
    : "Bloquear Persona"}
  description={`¿Estás seguro de que deseas cambiar el estado de acceso para ${selectedPerson?.name}?`}
  size="sm"
>
  <div class="p-4 bg-amber-50 rounded-xl border border-amber-100 mb-4">
    <div class="flex gap-3">
      <div class="mt-0.5 text-amber-600">
        <Lock size={20} />
      </div>
      <div>
        <h4 class="text-sm font-bold text-amber-900">Confirmar cambio</h4>
        <p class="text-sm text-amber-800 mt-1">
          {selectedPerson?.status === "blocked" ||
          selectedPerson?.status === "Bloqueado/a"
            ? "El usuario recuperará todos sus accesos asignados de forma inmediata."
            : "El usuario no podrá utilizar sus tarjetas de acceso hasta que sea desbloqueado manualmente."}
        </p>
      </div>
    </div>
  </div>

  <div class="flex justify-end gap-3 pt-2">
    <Button
      variant="secondary"
      onclick={() => (isBlockPersonModalOpen = false)}
    >
      Cancelar
    </Button>
    <Button
      variant="primary"
      onclick={confirmBlockPerson}
      loading={isProcessing}
    >
      {selectedPerson?.status === "blocked" ||
      selectedPerson?.status === "Bloqueado/a"
        ? "Confirmar Desbloqueo"
        : "Confirmar Bloqueo"}
    </Button>
  </div>
</Modal>

<!-- Deactivate Person Confirmation Modal -->
<Modal
  bind:isOpen={isDeactivatePersonModalOpen}
  title="Baja de Personal"
  description={`¿Estás seguro de que deseas dar de baja permanentemente a ${selectedPerson?.name}?`}
  size="sm"
>
  <div class="p-4 bg-rose-50 rounded-xl border border-rose-100 mb-4">
    <div class="flex gap-3">
      <div class="mt-0.5 text-rose-600">
        <UserX size={20} />
      </div>
      <div>
        <h4 class="text-sm font-bold text-rose-900">Acción Crítica</h4>
        <p class="text-sm text-rose-800 mt-1">
          Esta acción desvinculará automáticamente todas las tarjetas asignadas
          y marcará al personal como inactivo. <b
            >Esta acción no se puede deshacer de forma simple.</b
          >
        </p>
      </div>
    </div>
  </div>

  <div class="flex justify-end gap-3 pt-2">
    <Button
      variant="secondary"
      onclick={() => (isDeactivatePersonModalOpen = false)}
    >
      Cancelar
    </Button>
    <Button
      variant="danger"
      onclick={confirmDeactivatePerson}
      loading={isProcessing}
      class="bg-rose-600 hover:bg-rose-700 text-white"
    >
      Dar de Baja
    </Button>
  </div>
</Modal>

<!-- Reactivate Person Confirmation Modal -->
<Modal
  bind:isOpen={isReactivatePersonModalOpen}
  title="Reactivar Personal"
  description={`¿Estás seguro de que deseas reactivar a ${selectedPerson?.name}?`}
  size="sm"
>
  <div class="p-4 bg-emerald-50 rounded-xl border border-emerald-100 mb-4">
    <div class="flex gap-3">
      <div class="mt-0.5 text-emerald-600">
        <Lock size={20} />
      </div>
      <div>
        <h4 class="text-sm font-bold text-emerald-900">
          Confirmar Reactivación
        </h4>
        <p class="text-sm text-emerald-800 mt-1">
          El personal volverá a estar disponible para asignación de tarjetas y
          edición de datos.
        </p>
      </div>
    </div>
  </div>

  <div class="flex justify-end gap-3 pt-2">
    <Button
      variant="secondary"
      onclick={() => (isReactivatePersonModalOpen = false)}
    >
      Cancelar
    </Button>
    <Button
      variant="primary"
      onclick={confirmReactivatePerson}
      loading={isProcessing}
    >
      Reactivar
    </Button>
  </div>
</Modal>

<!-- Permanent Delete Confirmation Modal -->
<Modal
  bind:isOpen={isPermanentDeletePersonModalOpen}
  title="Eliminación Permanente"
  description={`¿Estás SEGURO de que deseas eliminar permanentemente a ${selectedPerson?.name}?`}
  size="sm"
>
  <div class="p-4 bg-rose-50 rounded-xl border border-rose-100 mb-4">
    <div class="flex gap-3">
      <div class="mt-0.5 text-rose-600">
        <Trash2 size={20} />
      </div>
      <div>
        <h4 class="text-sm font-bold text-rose-900">Acción Irreversible</h4>
        <p class="text-sm text-rose-800 mt-1">
          Todos los datos de esta persona serán borrados definitivamente. Esta
          acción no se puede deshacer.
        </p>
      </div>
    </div>
  </div>

  <div class="flex justify-end gap-3 pt-2">
    <Button
      variant="secondary"
      onclick={() => (isPermanentDeletePersonModalOpen = false)}
    >
      Cancelar
    </Button>
    <Button
      variant="danger"
      onclick={confirmPermanentDeletePerson}
      loading={isProcessing}
    >
      Eliminar Permanentemente
    </Button>
  </div>
</Modal>

<!-- Confirm Signature Modal -->
<Modal
  bind:isOpen={isConfirmSignModalOpen}
  title="Confirmar Firma de Responsiva"
  description={`¿Confirmas que se ha recabado la firma para la tarjeta ${selectedTicket?.cardFolio}?`}
  size="sm"
>
  <div class="p-4 bg-violet-50 rounded-xl border border-violet-100 mb-4">
    <div class="flex gap-3">
      <div class="mt-0.5 text-violet-600">
        <FileSignature size={20} />
      </div>
      <div>
        <h4 class="text-sm font-bold text-violet-900">Recabar Firma</h4>
        <p class="text-sm text-violet-800 mt-1">
          Asegúrate de tener el documento físico o digital firmado por {selectedTicket?.personName}
          antes de confirmar.
        </p>
      </div>
    </div>
  </div>

  <div class="flex justify-end gap-3 pt-2">
    <Button
      variant="secondary"
      onclick={() => (isConfirmSignModalOpen = false)}
    >
      Cancelar
    </Button>
    <Button
      variant="primary"
      onclick={confirmSignTicket}
      loading={isProcessing}
      disabled={currentUser?.role !== "admin"}
    >
      {currentUser?.role === "admin"
        ? "Confirmar Firma"
        : "Solo Administradores"}
    </Button>
  </div>
</Modal>

<!-- Confirm Programming Modal -->
<Modal
  bind:isOpen={isConfirmProgModalOpen}
  title="Confirmar Programación de Acceso"
  description={`¿Confirmas que se han configurado los accesos para la tarjeta ${selectedTicket?.cardFolio}?`}
  size="sm"
>
  <div class="p-4 bg-blue-50 rounded-xl border border-blue-100 mb-4">
    <div class="flex gap-3">
      <div class="mt-0.5 text-blue-600">
        <CreditCard size={20} />
      </div>
      <div>
        <h4 class="text-sm font-bold text-blue-900">
          Configuración P2000/KONE
        </h4>
        <p class="text-sm text-blue-800 mt-1">
          Verifica que la tarjeta tenga los niveles de acceso correctos en el
          sistema de control de acceso físico.
        </p>
      </div>
    </div>
  </div>

  <div class="flex justify-end gap-3 pt-2">
    <Button
      variant="secondary"
      onclick={() => (isConfirmProgModalOpen = false)}
    >
      Cancelar
    </Button>
    <Button
      variant="primary"
      onclick={confirmProgTicket}
      loading={isProcessing}
      disabled={currentUser?.role !== "admin"}
    >
      {currentUser?.role === "admin"
        ? "Confirmar Programación"
        : "Solo Administradores"}
    </Button>
  </div>
</Modal>

<!-- Ticket Options Modal (Quick Actions) -->
<Modal
  bind:isOpen={isTicketOptionsModalOpen}
  title="Gestión de Ticket"
  description="Selecciona una opción para procesar esta tarea."
  size="md"
>
  <div class="space-y-4">
    <div class="p-4 bg-slate-50 rounded-xl border border-slate-100">
      <div class="flex gap-3">
        <div class="mt-0.5 text-slate-600">
          <FileText size={20} />
        </div>
        <div>
          <h4 class="text-sm font-bold text-slate-900">
            {selectedTicket?.title}
          </h4>
          <p class="text-sm text-slate-500 mt-1">
            {selectedTicket?.description}
          </p>
        </div>
      </div>
    </div>

    <!-- Ticket Info Sections -->
    <div class="space-y-3">
      <!-- Creator Info -->
      {#if selectedTicket?.payload?.creator}
        <div
          class="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl"
        >
          <div
            class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500"
          >
            <Users size={16} />
          </div>
          <div>
            <p
              class="text-[10px] font-bold text-slate-500 uppercase tracking-wider"
            >
              Creado por
            </p>
            <p class="text-sm font-bold text-slate-900">
              {selectedTicket.payload.creator.name}
            </p>
            {#if selectedTicket.payload.creator.email}
              <p class="text-xs text-slate-500">
                {selectedTicket.payload.creator.email}
              </p>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Solicitor Info -->
      {#if selectedTicket?.payload?.solicitor && (selectedTicket.payload.solicitor.name || selectedTicket.payload.solicitor.department)}
        <div class="p-4 bg-white rounded-xl border border-slate-200">
          <h5
            class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3"
          >
            Datos del Solicitante
          </h5>
          <div class="grid grid-cols-2 gap-y-3 gap-x-4">
            <div>
              <span class="text-[10px] text-slate-400 font-bold uppercase block"
                >Nombre</span
              >
              <p class="text-sm font-medium text-slate-900">
                {selectedTicket.payload.solicitor.name || "N/A"}
              </p>
            </div>
            <div>
              <span class="text-[10px] text-slate-400 font-bold uppercase block"
                >Dependencia</span
              >
              <p class="text-sm font-medium text-slate-900">
                {selectedTicket.payload.solicitor.department || "N/A"}
              </p>
            </div>
            {#if selectedTicket.payload.solicitor.extension}
              <div>
                <span
                  class="text-[10px] text-slate-400 font-bold uppercase block"
                  >Extensión</span
                >
                <p class="text-sm font-medium text-slate-900">
                  {selectedTicket.payload.solicitor.extension}
                </p>
              </div>
            {/if}
            {#if selectedTicket.payload.solicitor.email}
              <div class="col-span-2">
                <span
                  class="text-[10px] text-slate-400 font-bold uppercase block"
                  >Correo</span
                >
                <p class="text-sm font-medium text-slate-900">
                  {selectedTicket.payload.solicitor.email}
                </p>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>

  {#snippet footer()}
    <Button
      variant="danger"
      class="gap-1.5 mr-auto"
      onclick={confirmRejectTicket}
      loading={isProcessing}
    >
      <Trash2 size={16} />
      Rechazar
    </Button>

    {#if selectedTicket?.personName && selectedTicket?.personName !== "N/A"}
      <Button
        variant="secondary"
        class="gap-1.5"
        onclick={() => {
          const person = personnel.find((p) => {
            const fullName = `${p.first_name} ${p.last_name}`;
            return fullName === selectedTicket?.personName;
          });
          if (person) {
            shouldRestoreTicketModal = true;
            isTicketOptionsModalOpen = false;
            openPersonDetails(person);
          }
        }}
      >
        <User size={16} />
        Ver Persona
      </Button>
    {/if}

    <Button
      variant="primary"
      class="gap-1.5 font-bold"
      onclick={() => {
        isTicketOptionsModalOpen = false;
        isCompleteTicketModalOpen = true;
      }}
    >
      <CheckCircle2 size={16} />
      Completar Ticket
    </Button>
  {/snippet}
</Modal>

<!-- Success Feedback Modal -->
<Modal bind:isOpen={isSuccessModalOpen} title={successData.title} size="sm">
  <div class="flex flex-col items-center text-center py-4">
    <div
      class="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-4"
    >
      <CheckCircle2 size={32} />
    </div>
    <p class="text-sm text-slate-600 font-medium">
      {successData.message}
    </p>
  </div>

  {#snippet footer()}
    <Button
      variant="primary"
      class="w-full bg-emerald-600 hover:bg-emerald-700 mt-2"
      onclick={() => (isSuccessModalOpen = false)}
    >
      Entendido
    </Button>
  {/snippet}
</Modal>

<ApproveChangeModal
  bind:isOpen={isApproveChangeModalOpen}
  ticket={selectedTicket}
  onClose={() => {
    isApproveChangeModalOpen = false;
    selectedTicket = null;
    initData();
  }}
/>

<Toaster position="top-right" richColors />
