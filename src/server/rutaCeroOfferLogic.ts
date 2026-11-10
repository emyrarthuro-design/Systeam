/**
 * Strict, server-side offer prices for the Ruta Cero six-week curriculum.
 * AI suggestions are drafts. Only these validated records become workbook offers.
 */
export class OfferValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OfferValidationError';
  }
}
export type SalesExperience = 'first' | 'experienced';
export type LowTicket = {
  experience: SalesExperience;
  name: string;
  format: string;
  includes: string;
  transformation: string;
  bonus: string;
  objection1: string;
  response1: string;
  objection2: string;
  response2: string;
  price: number;
};
export type NextLevel = {
  name: string;
  format: string;
  includes: string;
  transformation: string;
  reason: string;
  price: number;
  basedOnLowTicketPrice: number;
};

function textField(value: unknown, label: string, maxLength = 600): string {
  if (typeof value !== 'string') throw new OfferValidationError(`Completa el campo «${label}».`);
  const v = value.trim();
  if (!v) throw new OfferValidationError(`Completa el campo «${label}».`);
  if (v.length > maxLength) throw new OfferValidationError(`El campo «${label}» supera ${maxLength} caracteres.`);
  return v;
}
function money(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 ||
    Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) {
    throw new OfferValidationError('Ingresa un precio válido en USD, con máximo dos decimales.');
  }
  return Math.round(value * 100) / 100;
}
function moneyString(value: number): string {
  return '$' + value.toFixed(2) + ' USD';
}
export function lowTicketPriceBand(experience: SalesExperience) {
  return experience === 'first' ? { min: 7, max: 27 } : { min: 27, max: 100 };
}
export function validateLowTicket(value: unknown, experience: unknown): LowTicket {
  if (experience !== 'first' && experience !== 'experienced') {
    throw new OfferValidationError('Indica si has vendido antes para definir tu banda de precio.');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new OfferValidationError('Completa los detalles del Low Ticket.');
  }
  const v = value as Record<string, unknown>;
  const price = money(v.price);
  const band = lowTicketPriceBand(experience);
  if (price < band.min || price > band.max) {
    throw new OfferValidationError(`Tu Low Ticket debe costar entre $${band.min} y $${band.max} USD según tu experiencia.`);
  }
  return {
    experience,
    name: textField(v.name, 'nombre', 140),
    format: textField(v.format, 'formato', 250),
    includes: textField(v.includes, 'qué incluye', 900),
    transformation: textField(v.transformation, 'transformación', 500),
    bonus: textField(v.bonus, 'bono', 350),
    objection1: textField(v.objection1, 'objeción 1', 320),
    response1: textField(v.response1, 'respuesta 1', 450),
    objection2: textField(v.objection2, 'objeción 2', 320),
    response2: textField(v.response2, 'respuesta 2', 450),
    price
  };
}
export function validateNextLevel(value: unknown, lowTicket: unknown): NextLevel {
  if (!lowTicket || typeof lowTicket !== 'object' ||
    typeof (lowTicket as LowTicket).price !== 'number') {
    throw new OfferValidationError('Primero guarda y valida tu Low Ticket.');
  }
  const base = (lowTicket as LowTicket).price;
  if (!Number.isFinite(base) || base <= 0) {
    throw new OfferValidationError('El precio del Low Ticket guardado es inválido.');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new OfferValidationError('Completa los detalles del Siguiente Nivel.');
  }
  const v = value as Record<string, unknown>;
  const price = money(v.price);
  const cents = Math.round(price * 100);
  const lowCents = Math.round(base * 100);
  if (cents < 3 * lowCents || cents > 10 * lowCents) {
    throw new OfferValidationError(`El Siguiente Nivel debe valer entre ${moneyString(base * 3)} y ${moneyString(base * 10)} (3–10 veces tu Low Ticket).`);
  }
  return {
    name: textField(v.name, 'nombre', 140),
    format: textField(v.format, 'formato', 250),
    includes: textField(v.includes, 'qué incluye', 900),
    transformation: textField(v.transformation, 'transformación', 500),
    reason: textField(v.reason, 'por qué es el siguiente paso', 500),
    price,
    basedOnLowTicketPrice: base
  };
}
export function formatLowTicket(offer: LowTicket): string {
  return [
    'LOW TICKET — OFERTA VALIDADA',
    'Experiencia: ' + (offer.experience === 'first' ? 'Primera venta' : 'Ya ha vendido antes'),
    'Nombre: ' + offer.name, 'Formato: ' + offer.format,
    'Incluye: ' + offer.includes, 'Transformación: ' + offer.transformation,
    'Bono: ' + offer.bonus, 'Precio: ' + moneyString(offer.price),
    'Objeción 1: ' + offer.objection1, 'Respuesta 1: ' + offer.response1,
    'Objeción 2: ' + offer.objection2, 'Respuesta 2: ' + offer.response2
  ].join('\n');
}
export function formatNextLevel(offer: NextLevel): string {
  return [
    'SIGUIENTE NIVEL — OFERTA VALIDADA',
    'Nombre: ' + offer.name, 'Formato: ' + offer.format,
    'Incluye: ' + offer.includes, 'Transformación: ' + offer.transformation,
    'Por qué es el siguiente paso: ' + offer.reason,
    'Precio: ' + moneyString(offer.price),
    'Relación con Low Ticket: ' + (offer.price / offer.basedOnLowTicketPrice).toFixed(2) + 'x'
  ].join('\n');
}
