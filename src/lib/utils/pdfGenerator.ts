// src/lib/utils/pdfGenerator.ts
import { jsPDF } from "jspdf";
import { RESPONSIVA_LEGAL_TEXT } from "../constants/legal";

export async function generateResponsivaPdf(
    data: any,
    signature: string,
    bgImage: string,
    filename: string = "document.pdf",
    paragraphs: string[] = RESPONSIVA_LEGAL_TEXT,
    shouldSave: boolean = true
) {
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
        const lineHeight = 6.5; // Approx 1.5 line height for 11pt

        // Helper to draw text with bold support and justification
        const drawRichText = (text: string, x: number, y: number, maxWidth: number) => {
            // Split by words but preserve space logic
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

                // Check if adding this word (and a space if not first) exceeds width
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
            // Ensure placeholders are replaced (if they exist)
            const processedText = p
                .replace(/{nombre}/g, `**${data.nombre}**`)
                .replace(/{numEmpleado}/g, `**${data.numEmpleado}**`)
                .replace(/{dependencia}/g, `**${data.dependencia}**`)
                .replace(/{folio}/g, `**${data.folio}**`);

            currentY = drawRichText(processedText, margin, currentY, contentWidth);
            currentY += 4; // Gap between paragraphs (4mm)
        });

        // 5. Signature Area (Starting at 220mm)
        const sigBoxWidth = 80;
        const sigX = (pageWidth - sigBoxWidth) / 2;
        currentY = 220;

        // Signature Img (exactly like Svelte, bottom-aligned relative to box)
        if (signature) {
            // Box height is 25mm, img max-height 25mm
            doc.addImage(signature, 'PNG', pageWidth / 2 - 30, currentY - 26, 60, 25, undefined, 'FAST');
        }

        // Signature Line
        doc.setDrawColor(0);
        doc.setLineWidth(0.3);
        doc.line(sigX, currentY, sigX + sigBoxWidth, currentY);

        // Labels (9pt Bold, 10pt Normal)
        doc.setTextColor(68, 68, 68); // #444
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("FIRMA DEL EMPLEADO", pageWidth / 2, currentY + 5, { align: "center" });

        doc.setTextColor(0, 0, 0); // Black
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(data.nombre, pageWidth / 2, currentY + 11, { align: "center" });

        if (shouldSave) {
            doc.save(filename);
        }
        return doc;
    } catch (e) {
        console.error("Error generating PDF:", e);
        throw e;
    }
}
