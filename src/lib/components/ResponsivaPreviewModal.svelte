<script lang="ts">
    import Modal from "./Modal.svelte";
    import Button from "./Button.svelte";
    import ResponsivaTemplate from "./ResponsivaTemplate.svelte";
    import SignaturePad from "./SignaturePad.svelte";
    import { generateResponsivaPdf } from "../utils/pdfGenerator";
    import {
        FileSignature,
        Download,
        X,
        CheckCircle2,
        ShieldCheck,
        ShieldAlert,
        Mail,
        Save,
    } from "lucide-svelte";
    import { toast } from "svelte-sonner";
    import { responsivaService } from "../services/responsiva";
    import { cardService } from "../services/cards";
    import { supabase } from "../supabase";
    import { generateLegalHash } from "../utils/crypto";
    import { RESPONSIVA_LEGAL_TEXTS } from "../constants/legal";
    import bgImage from "../../assets/responsiva_bg.png";

    type Props = {
        isOpen: boolean;
        data: any;
        person?: any;
        card: any;
        signature?: string;
        onSign: (card: any, signature?: string) => Promise<void>;
        onClose: () => void;
    };

    let {
        isOpen = $bindable(),
        data,
        person,
        card,
        signature = "",
        onSign,
        onClose,
    }: Props = $props();

    let isSigning = $state(false);
    let isDownloading = $state(false);
    let showSignaturePad = $state(false);
    let signatureBase64 = $state("");
    let verificationStatus = $state<"loading" | "valid" | "invalid" | "none">(
        "none",
    );

    // Email capture state
    let showEmailPrompt = $state(false);
    let tempEmail = $state("");
    let saveEmailPermanently = $state(true);
    let isSavingEmail = $state(false);

    $effect(() => {
        if (isOpen) {
            // Only synchronize from prop if the prop is NOT empty
            // This allows viewing an existing signature without overwriting
            // a fresh one generated locally during the current session
            if (signature) {
                signatureBase64 = signature;
            }
            showEmailPrompt = false;
            tempEmail = person?.email || "";
            if (signatureBase64 && data.legal_hash) {
                verifyIntegrity();
            } else {
                verificationStatus = "none";
            }
        }
    });

    async function verifyIntegrity() {
        if (!data.legal_hash || !signature || !data.legal_snapshot) {
            verificationStatus = "none";
            return;
        }

        verificationStatus = "loading";
        try {
            const computed = await generateLegalHash(
                data,
                signature,
                data.legal_snapshot,
            );
            verificationStatus =
                computed === data.legal_hash ? "valid" : "invalid";
        } catch (e) {
            console.error("Error en verificación:", e);
            verificationStatus = "none";
        }
    }

    async function getBase64Image(url: string): Promise<string> {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    async function handleDownload() {
        if (!data) return;
        isDownloading = true;
        try {
            const typeLabel = card?.type ? ` ${card.type}` : "";
            // Format: "Apellido Paterno Apellido materno - [Dependencia]- Folio"
            let fileName = `Responsiva${typeLabel}_${data.numEmpleado}_${data.folio}.pdf`;

            if (person?.last_name && person?.first_name) {
                fileName = `Responsiva${typeLabel} - ${person.last_name} ${person.first_name} - [${data.dependencia}] - ${data.folio}.pdf`;
            } else if (data.nombre) {
                // Fallback using full name if parts are missing
                fileName = `Responsiva${typeLabel} - ${data.nombre} - [${data.dependencia}] - ${data.folio}.pdf`;
            }

            const snapshot = data.legal_snapshot || "";
            const paragraphs = snapshot
                ? snapshot.split("\n")
                : card?.type?.toUpperCase() === "P2000"
                  ? RESPONSIVA_LEGAL_TEXTS.P2000
                  : RESPONSIVA_LEGAL_TEXTS.KONE;

            const bgBase64 = (await getBase64Image(bgImage)) as string;
            await generateResponsivaPdf(
                data,
                signatureBase64,
                bgBase64,
                fileName,
                paragraphs,
            );
            toast.success("Descarga completada");
        } catch (error) {
            console.error(error);
            toast.error("Error al generar PDF");
        } finally {
            isDownloading = false;
        }
    }

    async function handleSign() {
        showSignaturePad = true;
    }

    async function handleSaveSignature(signature: string) {
        if (!card || !person || !data) {
            toast.error("Error: Información incompleta para firmar");
            return;
        }
        isSigning = true;
        try {
            const typeKey =
                card?.type?.toUpperCase() === "P2000" ? "P2000" : "KONE";
            const textToUse = RESPONSIVA_LEGAL_TEXTS[typeKey];

            const legalSnapshot = textToUse
                .map((p) =>
                    p
                        .replace(/{nombre}/g, `**${data.nombre}**`)
                        .replace(/{numEmpleado}/g, `**${data.numEmpleado}**`)
                        .replace(/{dependencia}/g, `**${data.dependencia}**`)
                        .replace(/{folio}/g, `**${data.folio}**`),
                )
                .join("\n");

            const legalHash = await generateLegalHash(
                data,
                signature,
                legalSnapshot,
            );

            // 2. Save to DB with legal integrity fields
            await responsivaService.save({
                person_id: person.id,
                folio: card.folio,
                card_type: card.type,
                data: data,
                signature: signature,
                legal_hash: legalHash,
                legal_snapshot: legalSnapshot,
            });

            // 3. Update card status
            await onSign(card, signature);

            // 4. Update local state to show signature in preview
            signatureBase64 = signature;
            showSignaturePad = false;

            toast.success("Responsiva firmada y sellada digitalmente");
        } catch (error: any) {
            console.error(
                "[ResponsivaPreviewModal] Error in signature flow:",
                error,
            );
            toast.error(
                `Error al guardar responsiva: ${error.message || "Error desconocido"}`,
            );
        } finally {
            isSigning = false;
        }
    }

    async function handleSendEmail() {
        const email = person?.email || data.email || tempEmail;

        if (!email && !showEmailPrompt) {
            showEmailPrompt = true;
            return;
        }

        if (!email && showEmailPrompt) {
            toast.error("Por favor ingrese un correo válido");
            return;
        }

        const subject = `Responsiva de Acceso - Folio ${data.folio} - ${data.nombre}`;

        const cardDescription =
            card?.type === "KONE"
                ? "KONE - Torniquetes elevadores"
                : card?.type === "P2000"
                  ? "P2000 - Puertas y estacionamiento"
                  : card?.type || "Acceso Electrónico";

        const body = `Estimado/a ${data.nombre},

Se adjunta la Carta Responsiva de Entrega de Acceso correspondiente a su equipo/tarjeta.

Detalles del documento:
• Tipo de acceso: ${cardDescription}
• Folio: ${data.folio}
• No. Empleado: ${data.numEmpleado}
• Dependencia: ${data.dependencia}
• Fecha de emisión: ${data.fecha}
${data.legal_hash ? `• ID Transacción: ${data.legal_hash.toUpperCase()}` : ""}

Por favor, conserve este documento para sus registros. Este archivo cuenta con una firma digital y sello de integridad para su validación legal.

Atentamente,
Control de Accesos - Nexa`;

        // Generate PDF for sharing (regardless of share vs mailto, it's good to have it ready)
        let pdfFile: File | null = null;
        try {
            const typeLabel = card?.type ? ` ${card.type}` : "";
            // Format: "Apellido Paterno Apellido materno - [Dependencia]- Folio"
            let fileName = `Responsiva${typeLabel}_${data.numEmpleado}_${data.folio}.pdf`;

            if (person?.last_name && person?.first_name) {
                fileName = `Responsiva${typeLabel} - ${person.last_name} ${person.first_name} - [${data.dependencia}] - ${data.folio}.pdf`;
            } else if (data.nombre) {
                // Fallback using full name if parts are missing
                fileName = `Responsiva${typeLabel} - ${data.nombre} - [${data.dependencia}] - ${data.folio}.pdf`;
            }
            const snapshot = data.legal_snapshot || "";
            const paragraphs = snapshot
                ? snapshot.split("\n")
                : card?.type?.toUpperCase() === "P2000"
                  ? RESPONSIVA_LEGAL_TEXTS.P2000
                  : RESPONSIVA_LEGAL_TEXTS.KONE;

            const bgBase64 = (await getBase64Image(bgImage)) as string;

            const doc = await generateResponsivaPdf(
                data,
                signatureBase64,
                bgBase64,
                fileName,
                paragraphs,
                false, // Don't save to disk immediately, we'll do it manually below
            );

            // AUTO-DOWNLOAD: Always download so the user has it ready
            doc.save(fileName);
            toast.success("Descargando responsiva para adjuntar...");

            const pdfBlob = doc.output("blob");
            pdfFile = new File([pdfBlob], fileName, {
                type: "application/pdf",
            });
        } catch (e) {
            console.error("Error preparing PDF for email:", e);
        }

        // 1. Try Web Share API with Files (Prioritized for Mobile)
        if (
            navigator.share &&
            pdfFile &&
            navigator.canShare &&
            navigator.canShare({ files: [pdfFile] })
        ) {
            try {
                await navigator.share({
                    title: subject,
                    text: body,
                    files: [pdfFile],
                });
                showEmailPrompt = false;
                return;
            } catch (e) {
                console.warn("Share failed, falling back:", e);
            }
        }

        // 2. Fallback: Save email if confirmed in prompt (only if we got here)
        if (
            showEmailPrompt &&
            tempEmail &&
            saveEmailPermanently &&
            person?.id
        ) {
            isSavingEmail = true;
            try {
                const { error } = await supabase
                    .from("personnel")
                    .update({ email: tempEmail })
                    .eq("id", person.id);

                if (error) throw error;
            } catch (e) {
                console.error("Error saving email:", e);
            } finally {
                isSavingEmail = false;
            }
        }

        // 3. Final Fallback: Mailto link (cannot attach files, but opens mail client)
        const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailtoUrl;
        showEmailPrompt = false;
    }

    let isFullscreen = $state(false);

    function toggleFullscreen() {
        isFullscreen = !isFullscreen;
    }

    function reset() {
        showSignaturePad = false;
        signatureBase64 = "";
        isFullscreen = false;
        onClose();
    }
</script>

<Modal
    bind:isOpen
    title={isFullscreen ? "" : "Previsualización de Responsiva"}
    size={isFullscreen ? "full" : "xl"}
    onclose={reset}
    showClose={!isFullscreen}
>
    <!-- Fullscreen Overlay or Standard View -->
    <div
        class="bg-slate-100 rounded-lg overflow-x-hidden overflow-y-auto flex flex-col items-center relative transition-all duration-300
               {isFullscreen
            ? 'fixed inset-0 z-[60] bg-slate-900 p-0 rounded-none'
            : 'p-2 sm:p-4 max-h-[70vh]'}"
    >
        {#if isFullscreen}
            <button
                class="fixed top-4 right-4 z-[70] p-3 rounded-full bg-black/50 text-white backdrop-blur-md border border-white/20 active:scale-95"
                onclick={toggleFullscreen}
                aria-label="Cerrar pantalla completa"
            >
                <X size={24} />
            </button>
        {/if}

        {#if !isFullscreen && showEmailPrompt}
            <div
                class="mb-4 w-full max-w-[215.9mm] p-6 rounded-2xl bg-white border border-blue-100 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300"
            >
                <div class="flex items-center gap-3 mb-4 text-blue-600">
                    <div class="p-2 rounded-lg bg-blue-50">
                        <Mail size={20} />
                    </div>
                    <div>
                        <h3 class="text-sm font-bold">Enviar por Correo</h3>
                        <p class="text-[11px] text-slate-500">
                            Ingresa el correo para enviar el documento
                        </p>
                    </div>
                </div>

                <div class="space-y-4">
                    <div class="space-y-1.5">
                        <label
                            for="temp-email"
                            class="text-[10px] font-bold text-slate-400 uppercase tracking-wider"
                            >Correo Electrónico</label
                        >
                        <input
                            id="temp-email"
                            type="email"
                            class="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                            placeholder="ejemplo@correo.com"
                            bind:value={tempEmail}
                        />
                    </div>

                    <div
                        class="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                bind:checked={saveEmailPermanently}
                            />
                            <span class="text-xs text-slate-600 font-medium"
                                >Guardar en la ficha del empleado</span
                            >
                        </label>

                        <Button
                            variant="primary"
                            size="sm"
                            onclick={handleSendEmail}
                            loading={isSavingEmail}
                        >
                            Confirmar y Enviar
                        </Button>
                    </div>
                </div>
            </div>
        {/if}

        {#if !isFullscreen && verificationStatus !== "none" && !showSignaturePad}
            <div
                class="mb-4 w-full max-w-[215.9mm] flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border gap-3 {verificationStatus ===
                'valid'
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                    : 'bg-rose-50 border-rose-100 text-rose-700'}"
            >
                <div class="flex items-center gap-3 text-left">
                    {#if verificationStatus === "loading"}
                        <div
                            class="h-4 w-4 border-2 border-current border-t-transparent animate-spin rounded-full"
                        ></div>
                        <span class="text-xs font-bold uppercase tracking-wide"
                            >Verificando integridad...</span
                        >
                    {:else if verificationStatus === "valid"}
                        <ShieldCheck size={18} />
                        <div class="flex flex-col">
                            <span
                                class="text-[10px] font-bold uppercase tracking-wide"
                                >Integridad Verificada</span
                            >
                            <span class="text-[10px] opacity-80"
                                >Este documento coincide exactamente con el
                                sello original.</span
                            >
                        </div>
                    {:else}
                        <ShieldAlert size={18} />
                        <div class="flex flex-col">
                            <span
                                class="text-[10px] font-bold uppercase tracking-wide"
                                >Aviso de Alteración</span
                            >
                            <span class="text-[10px] opacity-80"
                                >Los datos actuales no coinciden con la firma
                                original.</span
                            >
                        </div>
                    {/if}
                </div>
                {#if data.legal_hash}
                    <div
                        class="px-2 py-0.5 rounded bg-white/50 border border-current/20 text-[9px] font-mono self-start sm:self-auto"
                    >
                        ID: {data.legal_hash.substring(0, 8).toUpperCase()}
                    </div>
                {/if}
            </div>
        {/if}

        {#if showSignaturePad}
            <div
                class="bg-white p-4 sm:p-8 rounded-2xl shadow-xl w-full max-w-2xl min-h-[50vh] flex flex-col"
            >
                <SignaturePad
                    onSave={handleSaveSignature}
                    onCancel={() => (showSignaturePad = false)}
                    loading={isSigning}
                />
            </div>
        {:else}
            <!-- Responsive PDF container with scaling -->
            <div
                class="pdf-preview-wrapper relative {isFullscreen
                    ? 'scale-100 h-auto py-8'
                    : ''}"
            >
                <button
                    type="button"
                    class="pdf-scaler transition-transform duration-300 origin-top cursor-zoom-in group"
                    onclick={toggleFullscreen}
                >
                    {#if !isFullscreen}
                        <div
                            class="absolute inset-x-0 -top-8 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <span
                                class="bg-slate-900 text-white text-[10px] font-bold uppercase px-2 py-1 rounded"
                                >Ver pantalla completa</span
                            >
                        </div>
                    {/if}
                    <div
                        class="shadow-2xl bg-white"
                        id="responsiva-preview-content"
                    >
                        <ResponsivaTemplate
                            {data}
                            mode="preview"
                            signature={signatureBase64}
                            legalSnapshot={data.legal_snapshot}
                            cardType={card?.type}
                        />
                    </div>
                </button>
            </div>
        {/if}
    </div>

    {#snippet footer()}
        <div
            class="flex flex-col sm:flex-row gap-3 w-full sm:justify-between {isFullscreen
                ? 'hidden'
                : ''}"
        >
            <div class="order-2 sm:order-1">
                <Button
                    variant="ghost"
                    onclick={reset}
                    class="w-full sm:w-auto"
                    disabled={isSigning || isDownloading}
                >
                    <X size={18} class="mr-2" />
                    Cerrar
                </Button>
            </div>

            {#if !showSignaturePad}
                <div
                    class="grid grid-cols-2 sm:flex sm:flex-row gap-2 order-1 sm:order-2"
                >
                    {#if signatureBase64}
                        <Button
                            variant="outline"
                            onclick={handleSendEmail}
                            class="w-full sm:w-auto"
                            disabled={isSigning || isDownloading}
                        >
                            <Mail
                                size={18}
                                class="hidden sm:inline-block mr-2"
                            />
                            Email
                        </Button>
                    {/if}

                    <Button
                        variant={signatureBase64 ? "primary" : "outline"}
                        onclick={handleDownload}
                        class="w-full sm:w-auto"
                        loading={isDownloading}
                        disabled={isSigning}
                    >
                        <Download
                            size={18}
                            class="hidden sm:inline-block mr-2"
                        />
                        {signatureBase64 ? "Final" : "Borrador"}
                    </Button>

                    {#if !signatureBase64 && card?.responsiva_status !== "signed"}
                        <Button
                            variant="primary"
                            onclick={handleSign}
                            class="col-span-2 sm:w-auto"
                            loading={isSigning}
                            disabled={isDownloading}
                        >
                            <FileSignature size={18} class="mr-2" />
                            Firmar
                        </Button>
                    {/if}
                </div>
            {/if}
        </div>
    {/snippet}
</Modal>

<style>
    /* Responsive PDF scaling */
    .pdf-preview-wrapper {
        width: 100%;
        display: flex;
        justify-content: center;
        overflow-x: hidden;
    }

    .pdf-scaler {
        transform-origin: top center;
    }

    /* Scaling logic for mobile devices */
    @media (max-width: 850px) {
        .pdf-preview-wrapper:not(.scale-100) {
            /* Height must be adjusted manually since transform doesn't affect document flow */
            /* Letter height (1056px approx) * scale factor */
            height: calc(1056px * (100vw - 40px) / 816px);
            min-height: 400px;
        }
        .pdf-scaler:not(.scale-100) {
            /* 100vw minus modal padding (approx 40px) divided by original PDF width (215.9mm = 816px at 96dpi) */
            transform: scale(calc((100vw - 40px) / 816));
        }
    }

    @media (max-width: 640px) {
        .pdf-preview-wrapper:not(.scale-100) {
            height: calc(1056px * (100vw - 32px) / 816px);
        }
        .pdf-scaler:not(.scale-100) {
            transform: scale(calc((100vw - 32px) / 816));
        }
    }

    .pdf-preview-wrapper.scale-100 {
        background: #111;
        overflow: auto;
    }

    :global(.preview-mode) {
        position: relative !important;
        top: 0 !important;
        left: 0 !important;
        box-shadow: none !important;
    }
</style>
