/**
 * Limpia el RUT de puntos, guion y espacios, convirtiendo a mayúsculas
 */
export function cleanRut(rut: string): string {
  return rut.replace(/[^0-9kK]/g, '').toUpperCase();
}

/**
 * Formatea un RUT en tiempo real al formato XX.XXX.XXX-X
 */
export function formatRut(rut: string): string {
  const cleaned = cleanRut(rut);
  if (cleaned.length === 0) return '';
  
  const dv = cleaned.slice(-1);
  const body = cleaned.slice(0, -1);
  
  if (body.length === 0) return dv;

  let formatted = '';
  // Formatear el cuerpo con puntos
  let count = 0;
  for (let i = body.length - 1; i >= 0; i--) {
    const char = body.charAt(i);
    formatted = char + formatted;
    count++;
    if (count % 3 === 0 && i !== 0) {
      formatted = '.' + formatted;
    }
  }

  return `${formatted}-${dv}`;
}

/**
 * Valida un RUT chileno usando el algoritmo oficial (Módulo 11)
 */
export function validateRut(rut: string): boolean {
  const cleaned = cleanRut(rut);
  if (cleaned.length < 8 || cleaned.length > 9) return false;

  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);

  // Calcular dígito verificador esperado
  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body.charAt(i), 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const expectedDv = 11 - (sum % 11);
  let expectedDvStr = '';
  
  if (expectedDv === 11) expectedDvStr = '0';
  else if (expectedDv === 10) expectedDvStr = 'K';
  else expectedDvStr = String(expectedDv);

  return dv === expectedDvStr;
}

/**
 * Calcula la edad en años a partir de una fecha de nacimiento YYYY-MM-DD
 */
export function calculateAge(birthDateString: string): number {
  if (!birthDateString) return 0;
  const trimmed = birthDateString.trim();
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  const ymdMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);

  let birthDate: Date;
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    birthDate = new Date(year, month, day);
  } else if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    birthDate = new Date(year, month, day);
  } else {
    birthDate = new Date(birthDateString);
  }

  if (isNaN(birthDate.getTime())) return 0;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

/**
 * Verifica si es mayor de edad (>= 18 años)
 */
export function isAdult(birthDateString: string): boolean {
  if (!birthDateString) return false;
  return calculateAge(birthDateString) >= 18;
}

/**
 * Convierte cualquier fecha válida o string (YYYY-MM-DD, ISO, Date) a formato estricto dd-mm-yyyy
 */
export function formatDateToDDMMYYYY(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return '';

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    // Formato YYYY-MM-DD o YYYY/MM/DD
    const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (isoMatch) {
      const year = isoMatch[1];
      const month = isoMatch[2].padStart(2, '0');
      const day = isoMatch[3].padStart(2, '0');
      return `${day}-${month}-${year}`;
    }
    // Formato DD-MM-YYYY o DD/MM/YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return `${day}-${month}-${year}`;
    }
  }

  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

