// Calendario y nombres del Manual General de Mentores de Ruta Cero.
const weeks = [
  ['Encuentra tu Punto Cero', 'Michelly', [
    ['11-09', 'Tu historia y tu Punto Cero', 'Declaración de Punto Cero e inventario de fortalezas.'],
    ['11-10', 'Bajo Cero, Zona de Genio y Oportunidad', 'Radar de Genio y ángulo de oportunidad.'],
    ['11-11', 'Cliente Ideal y Arquitectura de Marca', 'Ficha de cliente ideal y arquitectura de marca.']
  ]],
  ['Construye tu Autoridad', 'Juan ID', [
    ['11-16', 'Tus Pilares de Autoridad', 'Pilares y primeras ideas de contenido.'],
    ['11-17', 'Bajo Cero, Bio y Comunicación', 'Biografía y una publicación o video.'],
    ['11-18', 'Tu Primer Live Grupal', 'Guion o evidencia del live grupal.']
  ]],
  ['Crea Algo Vendible', 'Michelly', [
    ['11-23', 'Bajo Cero y Tu Oferta a Precio Real', 'Borrador de oferta con promesa y precio.'],
    ['11-24', 'Arquitectura de una Oferta Irresistible', 'Ficha de oferta con estructura, precio y bono.'],
    ['11-25', 'Validación de Oferta', 'Evidencia de validación y versión ajustada de la oferta.']
  ]],
  ['Lanzamiento', 'Emyr', [
    ['11-30', 'Bajo Cero y Diseña tu Clase de Autoridad', 'Guion o presentación de la clase de autoridad.'],
    ['12-01', 'Llena tu Zoom', 'Convocatoria y mecanismo de registro.'],
    ['12-02', 'Ensayo General del Lanzamiento', 'Evidencia del ensayo y lista de ajustes.']
  ]],
  ['Tus Primeras Ventas', 'Iván', [
    ['12-09', 'Ejecuta tu Clase de Autoridad', 'Grabación o evidencia de la clase ejecutada.'],
    ['12-10', 'Bajo Cero y Seguimiento Comercial', 'Registro de conversaciones y plan de seguimiento.'],
    ['12-11', 'Objeciones y Cierre Comercial', 'Guion de objeciones y registro de aprendizajes del cierre.']
  ]],
  ['Tu Sistema Mínimo Viable', 'Ricardo', [
    ['12-14', 'Bajo Cero y Sistema Mínimo de Contenido', 'Sistema mínimo de contenido.'],
    ['12-15', 'Testimonios y Prueba Social', 'Banco de testimonios o plan para recopilarlos.'],
    ['12-16', 'Ecosistema de Marca y Plan de 90 Días', 'Plan de crecimiento de 90 días.']
  ]]
] as const;

export const lessons = weeks.flatMap(([weekTitle, teacher, classes], index) =>
  classes.map(([date, title, deliverable], day) => ({
    id: `s${index + 1}c${day + 1}`, week: index + 1, weekTitle, teacher, day: day + 1,
    date: `2026-${date}`, title, deliverable
  }))
);

export const MAX_DELIVERABLE_BYTES = 10 * 1024 * 1024;
export const DELIVERABLE_EXTENSIONS = ['pdf', 'docx', 'pptx', 'xlsx', 'png', 'jpg', 'jpeg', 'webp', 'txt', 'csv'] as const;
