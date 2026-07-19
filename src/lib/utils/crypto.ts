export async function generateLegalHash(data: any, signature: string, legalSnippet: string): Promise<string> {
    // Solo hasheamos los campos de datos centrales para asegurar estabilidad entre guardado y verificación
    // excluding metadata like legal_hash or legal_snapshot that might be in the object
    const stableData = {
        folio: data.folio,
        nombre: data.nombre,
        numEmpleado: data.numEmpleado,
        dependencia: data.dependencia,
        fecha: data.fecha
    };

    const content = JSON.stringify({
        data: stableData,
        signature,
        legalSnippet
    });

    const msgUint8 = new TextEncoder().encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
}
