<script lang="ts">
    import { onMount } from "svelte";
    import bgImg from "../../assets/responsiva_bg.png";
    import { RESPONSIVA_LEGAL_TEXTS } from "../constants/legal";

    type Props = {
        data: {
            folio: string;
            nombre: string;
            numEmpleado: string;
            dependencia: string;
            usuarioEntrega: string;
            fecha: string; // Formatted date string
        } | null;
        id?: string;
        mode?: "hidden" | "preview";
        signature?: string; // Base64 signature
        legalSnapshot?: string; // Snapshot from DB
        cardType?: "KONE" | "P2000";
    };

    let {
        data = null,
        id = "responsiva-template",
        mode = "hidden",
        signature = "",
        legalSnapshot = "",
        cardType = "KONE",
    }: Props = $props();

    const paragraphs = $derived.by(() => {
        if (legalSnapshot) return legalSnapshot.split("\n");
        const typeKey = cardType?.toUpperCase() === "P2000" ? "P2000" : "KONE";
        return RESPONSIVA_LEGAL_TEXTS[typeKey];
    });
</script>

<div
    {id}
    class="pdf-container {mode === 'hidden'
        ? 'hidden-off-screen'
        : 'preview-mode'}"
    style="--bg-url: url('{bgImg}')"
>
    {#if data}
        <div class="page">
            <!-- Professional Background Image -->
            <img src={bgImg} alt="" class="page-background" />

            <!-- Header -->
            <div class="header">
                <div class="date-line">
                    Monterrey, N.L. a {data.fecha}
                </div>
            </div>

            <!-- Title -->
            <h1 class="title">CARTA RESPONSIVA DE ENTREGA DE ACCESO</h1>

            <!-- Body -->
            <div class="content">
                {#each paragraphs as paragraph}
                    <p>
                        {@html paragraph.includes("{")
                            ? paragraph
                                  .replace(
                                      "{nombre}",
                                      `<strong>${data.nombre}</strong>`,
                                  )
                                  .replace(
                                      "{numEmpleado}",
                                      `<strong>${data.numEmpleado}</strong>`,
                                  )
                                  .replace(
                                      "{dependencia}",
                                      `<strong>${data.dependencia}</strong>`,
                                  )
                                  .replace(
                                      "{folio}",
                                      `<strong>${data.folio}</strong>`,
                                  )
                            : paragraph.replace(
                                  /\*\*(.*?)\*\*/g,
                                  "<strong>$1</strong>",
                              )}
                    </p>
                {/each}
            </div>

            <!-- Signatures -->
            <div class="signatures">
                <div class="signature-box">
                    <div class="signature-wrapper">
                        {#if signature}
                            <img
                                src={signature}
                                alt="Firma"
                                class="signature-img"
                            />
                        {/if}
                        <div class="signature-line"></div>
                    </div>
                    <div class="signature-label">Firma del Empleado</div>
                    <div class="name">{data.nombre}</div>
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
    /* This style block is critical for the PDF generation */
    .pdf-container {
        position: absolute;
        top: 0px;
        left: 0px;
        width: 215.9mm; /* Letter width */
        /* min-height: 279.4mm; Letter height */
        background: white;
        color: black;
        font-family: "Arial", sans-serif; /* Standard legal font */
    }

    .page {
        position: relative;
        padding: 25mm; /* Standard margins */
        display: flex;
        flex-direction: column;
        min-height: 279.4mm; /* Ensure it covers the whole letter height */
        background: white;
        z-index: 0;
    }

    .page-background {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        z-index: -1;
        pointer-events: none;
    }

    .header {
        margin-bottom: 20mm;
        text-align: right;
    }

    .date-line {
        margin-top: 30mm;
        font-size: 11pt;
    }

    .title {
        text-align: center;
        font-size: 14pt;
        font-weight: bold;
        margin-bottom: 15mm;
    }

    .content {
        font-size: 11pt;
        line-height: 1.5;
        text-align: justify;
    }

    .content p {
        margin-bottom: 4mm;
    }

    .content :global(strong) {
        font-weight: bold;
    }

    .signatures {
        display: flex;
        justify-content: center;
        margin-top: 10mm;
    }

    .signature-box {
        text-align: center;
        width: 80mm;
    }

    .signature-wrapper {
        position: relative;
        height: 25mm;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        margin-bottom: 2mm;
    }

    .signature-img {
        position: absolute;
        bottom: 1mm;
        max-height: 25mm;
        max-width: 60mm;
        object-fit: contain;
        z-index: 10;
    }

    .signature-line {
        width: 100%;
        border-top: 1px solid black;
        z-index: 5;
    }

    .signature-label {
        font-size: 9pt;
        font-weight: bold;
        text-transform: uppercase;
        color: #444;
    }

    .name {
        font-size: 10pt;
        margin-top: 1mm;
    }

    /* Helper class to hide from screen but allow generation */
    /* Note: We actually position it off-screen above, so this might be redundant or for specific controls */
</style>
