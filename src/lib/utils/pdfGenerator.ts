// src/lib/utils/pdfGenerator.ts
import type { jsPDF as jsPDFType } from "jspdf";
import { RESPONSIVA_LEGAL_TEXT } from "../constants/legal";

export async function generateCardPdf(
    folio: string,
    type: "P2000" | "KONE"
) {
    const { jsPDF } = await import("jspdf");

    // Dimensiones estándar de tarjeta CR80: 54mm x 85.6mm (vertical)
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [54, 85.6]
    });

    const pageWidth = 54;
    const pageHeight = 85.6;

    try {
        // Fondo - blanco
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pageWidth, pageHeight, "F");

        // Color del tipo de tarjeta
        const typeColor = type === "KONE" ? [14, 165, 233] : [245, 158, 11]; // Azul para KONE, Ámbar para P2000
        const typeLabel = type === "KONE" ? "Elevadores" : "Puertas";

        // Etiqueta de tipo (grande, centrada arriba)
        doc.setTextColor(typeColor[0], typeColor[1], typeColor[2]);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text(type, pageWidth / 2, 15, { align: "center" });

        // Subtítulo (más pequeño, debajo del tipo)
        doc.setTextColor(100, 100, 100);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(typeLabel, pageWidth / 2, 22, { align: "center" });

        // Línea divisoria
        doc.setDrawColor(typeColor[0], typeColor[1], typeColor[2]);
        doc.setLineWidth(0.5);
        doc.line(8, 26, pageWidth - 8, 26);

        // Etiqueta de folio
        doc.setTextColor(100, 100, 100);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("FOLIO", pageWidth / 2, 38, { align: "center" });

        // Número de folio (grande, centrado)
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(24);
        doc.text(folio, pageWidth / 2, 52, { align: "center" });

        // Abrir diálogo de impresión
        doc.autoPrint();
        window.open(doc.output('bloburl'), '_blank');

        return doc;
    } catch (e) {
        throw e;
    }
}

export async function generateResponsivaPdf(
    data: any,
    signature: string,
    bgImage: string,
    filename: string = "document.pdf",
    paragraphs: string[] = RESPONSIVA_LEGAL_TEXT,
    shouldSave: boolean = true
) {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "letter"
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 25;
    const contentWidth = pageWidth - (margin * 2);

    try {
        // 1. Background
        if (bgImage) {
            doc.addImage(bgImage, 'PNG', 0, 0, pageWidth, doc.internal.pageSize.getHeight(), undefined, 'FAST');
        }

        // 2. Header Date (Date line: 11pt, 55mm from top)
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.text(`Monterrey, N.L. a ${data.fecha}`, pageWidth - margin, 55, { align: "right" });

        // 3. Title (14pt, Bold, 80mm from top)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("CARTA RESPONSIVA DE ENTREGA DE ACCESO", pageWidth / 2, 80, { align: "center" });

        // 4. Body Paragraphs (11pt, 100mm from top, Justified with Bold spots)
        let currentY = 100;
        const fontSize = 11;
        const lineHeight = 6.5; // Aprox. 1.5 altura de línea para 11pt

        // Dibujar texto con soporte de negritas y justificación
        const drawRichText = (text: string, x: number, y: number, maxWidth: number) => {
            // Dividir por palabras pero preservar lógica de espacios
            const rawWords = text.split(/\s+/);
            let lines: any[] = [];
            let currentLine: any[] = [];
            let currentLineWidth = 0;

            doc.setFontSize(fontSize);
            const spaceWidth = doc.getTextWidth(" ");

            rawWords.forEach(word => {
                let weight: "normal" | "bold" = "normal";
                let cleanWord = word;

                if (word.includes("**")) {
                    cleanWord = word.replace(/\*\*/g, "");
                    weight = "bold";
                }

                doc.setFont("helvetica", weight);
                const wordWidth = doc.getTextWidth(cleanWord);

                // Verificar si añadir esta palabra (y espacio si no es la primera) excede el ancho
                const spaceNeeded = currentLine.length > 0 ? spaceWidth : 0;
                if (currentLineWidth + spaceNeeded + wordWidth > maxWidth) {
                    lines.push({ words: currentLine, width: currentLineWidth });
                    currentLine = [];
                    currentLineWidth = 0;
                }

                currentLine.push({ text: cleanWord, width: wordWidth, weight });
                currentLineWidth += (currentLine.length > 1 ? spaceWidth : 0) + wordWidth;
            });

            if (currentLine.length > 0) {
                lines.push({ words: currentLine, width: currentLineWidth, isLast: true });
            }

            lines.forEach((line, lineIdx) => {
                let cursorX = x;
                const isLastLine = line.isLast || lineIdx === lines.length - 1;

                let extraSpace = 0;
                if (!isLastLine && line.words.length > 1) {
                    const totalTextWidth = line.words.reduce((s: number, w: any) => s + w.width, 0);
                    const totalSpacesWidth = (line.words.length - 1) * spaceWidth;
                    extraSpace = (maxWidth - (totalTextWidth + totalSpacesWidth)) / (line.words.length - 1);
                }

                line.words.forEach((wordObj: any, wordIdx: number) => {
                    doc.setFont("helvetica", wordObj.weight);
                    doc.text(wordObj.text, cursorX, y);
                    cursorX += wordObj.width;
                    if (wordIdx < line.words.length - 1) {
                        cursorX += spaceWidth + extraSpace;
                    }
                });
                y += lineHeight;
            });

            return y;
        };

        paragraphs.forEach(p => {
            // Asegurar que los placeholders se reemplacen (si existen)
            const processedText = p
                .replace(/{nombre}/g, `**${data.nombre}**`)
                .replace(/{numEmpleado}/g, `**${data.numEmpleado}**`)
                .replace(/{dependencia}/g, `**${data.dependencia}**`)
                .replace(/{folio}/g, `**${data.folio}**`);

            currentY = drawRichText(processedText, margin, currentY, contentWidth);
            currentY += 4; // Espacio entre párrafos (4mm)
        });

        // 5. Signature Area (Starting at 220mm)
        const sigBoxWidth = 80;
        const sigX = (pageWidth - sigBoxWidth) / 2;
        currentY = 220;

        // Imagen de firma (alineada al fondo relativo al cuadro)
        if (signature) {
            // Altura del cuadro es 25mm, img max-height 25mm
            doc.addImage(signature, 'PNG', pageWidth / 2 - 30, currentY - 26, 60, 25, undefined, 'FAST');
        }

        // Línea de firma
        doc.setDrawColor(0);
        doc.setLineWidth(0.3);
        doc.line(sigX, currentY, sigX + sigBoxWidth, currentY);

        // Etiquetas (9pt Negrita, 10pt Normal)
        doc.setTextColor(68, 68, 68); // #444
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("FIRMA DEL EMPLEADO", pageWidth / 2, currentY + 5, { align: "center" });

        doc.setTextColor(0, 0, 0); // Negro
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(data.nombre, pageWidth / 2, currentY + 11, { align: "center" });

        if (shouldSave) {
            doc.save(filename);
        }
        return doc;
    } catch (e) {
        throw e;
    }
}
