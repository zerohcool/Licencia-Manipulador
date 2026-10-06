import { DOMParser, XMLSerializer } from 'xmldom';
import PizZip from 'pizzip';

/**
 * Procesa el contenido XML de un archivo de Word para reemplazar los MERGEFIELDs
 * con los valores proporcionados.
 */
function processXmlContent(xmlStr: string, data: Record<string, any>): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlStr, 'application/xml');

  // 1. Procesar Campos Simples (<w:fldSimple w:instr="MERGEFIELD nombre">)
  const fldSimples = doc.getElementsByTagName('w:fldSimple');
  // Iterar en orden inverso para poder modificar el DOM de forma segura sin desordenar los índices
  for (let i = fldSimples.length - 1; i >= 0; i--) {
    const fldSimple = fldSimples[i];
    const instr = fldSimple.getAttribute('w:instr') || '';
    const match = instr.match(/MERGEFIELD\s+"?([^"\s\\><]+)"?/i);

    if (match) {
      const varName = match[1];
      const val = data[varName] !== undefined ? String(data[varName]) : '';

      // Buscar todos los elementos de texto <w:t> dentro del campo simple
      const tElements = fldSimple.getElementsByTagName('w:t');
      if (tElements.length > 0) {
        // Asignar el valor al primer w:t y vaciar los demás
        tElements[0].textContent = val;
        for (let j = 1; j < tElements.length; j++) {
          tElements[j].textContent = '';
        }
      }

      // Reemplazar el nodo fldSimple por sus nodos hijos (conservando el formato run)
      const parent = fldSimple.parentNode;
      if (parent) {
        while (fldSimple.firstChild) {
          parent.insertBefore(fldSimple.firstChild, fldSimple);
        }
        parent.removeChild(fldSimple);
      }
    }
  }

  // 2. Procesar Campos Complejos
  // Los campos complejos se distribuyen en múltiples elementos hermanos (runs) en un párrafo (<w:p>)
  const paragraphs = doc.getElementsByTagName('w:p');
  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const p = paragraphs[pIdx];
    const childNodes = Array.from(p.childNodes) as any[];

    let inField = false;
    let fieldNodes: any[] = [];
    let fieldName: string | null = null;

    for (let nodeIdx = 0; nodeIdx < childNodes.length; nodeIdx++) {
      const node = childNodes[nodeIdx];

      // Detectar inicio de campo complejo
      if (node.nodeName === 'w:r') {
        const fldChars = node.getElementsByTagName('w:fldChar');
        if (fldChars.length > 0) {
          const fldCharType = fldChars[0].getAttribute('w:fldCharType');
          if (fldCharType === 'begin') {
            // Si ya estábamos en un campo sin cerrar, reiniciar
            inField = true;
            fieldNodes = [node];
            fieldName = null;
            continue;
          }
        }
      }

      if (inField) {
        fieldNodes.push(node);

        // Buscar el nombre del campo en la instrucción
        if (node.nodeName === 'w:r') {
          const instrTexts = node.getElementsByTagName('w:instrText');
          if (instrTexts.length > 0) {
            const instr = instrTexts[0].textContent || '';
            const match = instr.match(/MERGEFIELD\s+"?([^"\s\\><]+)"?/i);
            if (match) {
              fieldName = match[1];
            }
          }
        }

        // Detectar fin de campo complejo
        const fldChars = node.nodeName === 'w:r' ? node.getElementsByTagName('w:fldChar') : [];
        if (fldChars.length > 0 && fldChars[0].getAttribute('w:fldCharType') === 'end') {
          if (fieldName) {
            const val = data[fieldName] !== undefined ? String(data[fieldName]) : '';

            // Encontrar el primer run que contenga un w:t para inyectarle el valor
            let targetRun: any = null;
            for (const fn of fieldNodes) {
              if (fn.nodeName === 'w:r') {
                const ts = fn.getElementsByTagName('w:t');
                if (ts.length > 0) {
                  targetRun = fn;
                  break;
                }
              }
            }

            if (targetRun) {
              // Si encontramos un run con texto, actualizamos el texto del primer w:t y vaciamos el resto
              const ts = targetRun.getElementsByTagName('w:t');
              ts[0].textContent = val;
              for (let k = 1; k < ts.length; k++) {
                ts[k].textContent = '';
              }

              // Eliminar todos los demás nodos asociados a este campo complejo del párrafo
              fieldNodes.forEach((fn) => {
                if (fn !== targetRun && fn.parentNode === p) {
                  p.removeChild(fn);
                }
              });
            } else {
              // Si no había ningún run con texto, creamos uno con el estilo del primer run del campo
              const firstRun = fieldNodes[0];
              const rPr = firstRun.getElementsByTagName('w:rPr')[0];

              const newRun = doc.createElement('w:r');
              if (rPr) {
                newRun.appendChild(rPr.cloneNode(true));
              }
              const newT = doc.createElement('w:t');
              newT.textContent = val;
              newRun.appendChild(newT);

              // Insertar el nuevo run antes del primer nodo del campo y eliminar todos los nodos del campo
              p.insertBefore(newRun, firstRun);
              fieldNodes.forEach((fn) => {
                if (fn.parentNode === p) {
                  p.removeChild(fn);
                }
              });
            }
          }

          // Salir del estado de campo
          inField = false;
          fieldNodes = [];
          fieldName = null;
        }
      }
    }
  }

  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc);
}

/**
 * Lee una plantilla de Word (.docm / .docx) en base a un buffer,
 * reemplaza los MERGEFIELDs y retorna el buffer del documento generado.
 */
export function fillMergeFields(templateBuffer: Buffer, data: Record<string, any>): Buffer {
  const zip = new PizZip(templateBuffer);
  const files = zip.files;

  for (const fileName in files) {
    // Procesar sólo los archivos XML que suelen tener los MergeFields (documento principal, cabeceras, pies)
    if (fileName.endsWith('.xml') && (
      fileName.startsWith('word/document') ||
      fileName.startsWith('word/header') ||
      fileName.startsWith('word/footer')
    )) {
      const file = zip.file(fileName);
      if (file) {
        const originalXml = file.asText();
        const updatedXml = processXmlContent(originalXml, data);
        zip.file(fileName, updatedXml);
      }
    }
  }

  return zip.generate({ type: 'nodebuffer' });
}
