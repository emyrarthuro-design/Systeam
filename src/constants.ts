export const APP_PUBLIC_URL = "https://diagn-stico-inicial-del-experto-systeam-384081431912.us-west1.run.app";

import { DiagnosisBlock } from './types';

export const DIAGNOSIS_STRUCTURE: DiagnosisBlock[] = [
  {
    id: 0,
    title: "Bienvenida",
    questions: [],
    type: "welcome"
  },
  {
    id: 1,
    title: "Punto de partida",
    type: "questions",
    questions: [
      { id: "b1_p1", label: "¿Cuál es tu área de conocimiento o especialidad?", type: "text" },
      { id: "b1_p2", label: "¿Hace cuánto tiempo trabajas, estudias o te formas en este tema?", type: "select", options: ["Menos de 1 año", "1-2 años", "3-5 años", "6-10 años", "Más de 10 años"] },
      { id: "b1_p3", label: "Tu experiencia ayudando a otros:", type: "select", options: ["Aún no he ayudado a nadie con esto", "Sí, pero solo de forma informal", "Sí, con casos y resultados concretos"] },
      { id: "b1_p3_exp", label: "Cuéntame brevemente algún caso:", type: "text", condition: { field: "b1_p3", value: "Sí, con casos y resultados concretos" } },
      { id: "b1_p4", label: "Tu situación económica actual con esto:", type: "select", options: ["No lo monetizo todavía", "Lo hago como complemento de otros ingresos", "Vivo de esto"] },
      { 
        id: "b1_p5", 
        label: "Selecciona la frase que más te representa hoy:", 
        type: "select", 
        options: [
          "Soy experto, pero todavía no tengo oferta",
          "Tengo experiencia, pero no sé cómo comunicarla",
          "Tengo una oferta, pero no vendo como quiero",
          "Creo contenido, pero no logro convertir",
          "Vendo servicios, pero quiero crear un producto digital",
          "Tengo comunidad, pero no tengo modelo de negocio claro",
          "Estoy empezando desde cero, pero tengo mucho conocimiento",
          "Ya facturo, pero quiero ordenar y escalar"
        ]
      }
    ]
  },
  {
    id: 2,
    title: "Biología del experto",
    type: "questions",
    questions: [
      { id: "b2_p1", label: "Cuando piensas en mostrarte y vender tu conocimiento, ¿qué sensaciones aparecen?", type: "text" },
      { id: "b2_p2", label: "¿Qué te frena más hoy: el miedo al juicio, miedo a cobrar, perfeccionismo, falta de claridad u otra cosa?", type: "text" },
      { id: "b2_p3", label: "Frente a decisiones importantes, ¿cómo reaccionas habitualmente?", type: "select", multiple: true, options: ["Accionar rápido", "Postergar", "Perfeccionar antes de avanzar", "Abandonar a medio camino", "Buscar mucha información antes de decidir", "Otra"] },
      { id: "b2_p3_exp", label: "¿Otra? Cuéntame:", type: "text", condition: { field: "b2_p3", value: "Otra" } },
      { id: "b2_s1", label: "Tengo claridad para tomar decisiones", type: "scale" },
      { id: "b2_s2", label: "Me siento seguro/a mostrando mi conocimiento", type: "scale" },
      { id: "b2_s3", label: "Puedo sostener la acción aunque tenga miedo", type: "scale" },
      { id: "b2_s4", label: "Me permito cobrar por lo que sé", type: "scale" },
      { id: "b2_s5", label: "Mi energía actual acompaña mis objetivos", type: "scale" }
    ]
  },
  {
    id: 3,
    title: "Creencias y autosabotaje",
    type: "questions",
    questions: [
      { id: "b3_p1_1", label: "Sobre vender mi conocimiento, creo que:", type: "text" },
      { id: "b3_p1_2", label: "Sobre cobrar precios altos, creo que:", type: "text" },
      { id: "b3_p1_3", label: "Sobre mostrarme en redes, creo que:", type: "text" },
      { id: "b3_p1_4", label: "Sobre mi autoridad como experto, creo que:", type: "text" },
      { id: "b3_p2", label: "¿Qué excusa repites para no avanzar?", type: "text" },
      { id: "b3_p3", label: "¿Qué vienes postergando hace tiempo?", type: "text" },
      { id: "b3_p4", label: "Marca todos los autosabotajes que reconoces en ti:", type: "select", multiple: true, options: [
        "Perfeccionismo", "Miedo al juicio", "Miedo a cobrar", "Comparación constante", "Exceso de formación", "Falta de foco", "Cambiar de idea constantemente", "No terminar lo que empiezo", "No hacer llamados a la acción", "Crear contenido sin vender", "Hablarle a todo el mundo", "Sentir que \"me falta algo\""
      ]}
    ]
  },
  {
    id: 4,
    title: "ADN de marca",
    type: "questions",
    questions: [
      { id: "b4_p1", label: "¿Qué problema viviste, resolviste o estudiaste profundamente que te trajo hasta este conocimiento?", type: "text" },
      { id: "b4_p2", label: "¿Qué te diferencia de otros expertos de tu área?", type: "text" },
      { id: "b4_p3", label: "¿Qué valores no negocias en tu forma de trabajar?", type: "text" },
      { id: "b4_p4", label: "¿Qué tema podrías hablar durante horas sin impostar?", type: "text" },
      { id: "b4_p5", label: "¿Qué quieres que las personas sientan y recuerden cuando entren en contacto con tu marca?", type: "text" },
      { id: "b4_ej1", label: "Mi marca existe para ayudar a... (¿A quién?)", type: "text" },
      { id: "b4_ej2", label: "...a dejar de... (¿Qué problema?)", type: "text" },
      { id: "b4_ej3", label: "...y lograr... (¿Qué resultado?)", type: "text" },
      { id: "b4_ej4", label: "...a través de... (¿Tu método/enfoque?)", type: "text" }
    ]
  },
  {
    id: 5,
    title: "Avatar emocional",
    type: "questions",
    questions: [
      { id: "b5_p1", label: "¿A quién quieres ayudar específicamente? (Describe situación, momento de vida, mentalidad)", type: "text" },
      { id: "b5_p2", label: "¿Qué le duele a esa persona hoy, aunque no siempre lo diga?", type: "text" },
      { id: "b5_p3_1", label: "¿Qué le impide avanzar?", type: "text" },
      { id: "b5_p3_2", label: "¿Qué intentó antes sin éxito?", type: "text" },
      { id: "b5_p4", label: "¿Qué objeción tendría antes de comprarte?", type: "text" },
      { id: "b5_p5", label: "¿Qué resultado lo haría sentir que valió la pena invertir?", type: "text" }
    ]
  },
  {
    id: 6,
    title: "Oferta y promesa",
    type: "questions",
    questions: [
      { id: "b6_gate", label: "¿Hoy tienes una oferta concreta?", type: "select", options: ["Sí", "No"] },
      
      // Camino A (Sí)
      { id: "b6_a_p1_1", label: "¿Cómo se llama tu oferta?", type: "text", condition: { field: "b6_gate", value: "Sí" } },
      { id: "b6_a_p1_2", label: "¿Qué problema resuelve?", type: "text", condition: { field: "b6_gate", value: "Sí" } },
      { id: "b6_a_p2_1", label: "¿Qué transformación promete?", type: "text", condition: { field: "b6_gate", value: "Sí" } },
      { id: "b6_a_p2_2", label: "¿En cuánto tiempo?", type: "text", condition: { field: "b6_gate", value: "Sí" } },
      { id: "b6_a_p3_1", label: "¿Qué incluye?", type: "text", condition: { field: "b6_gate", value: "Sí" } },
      { id: "b6_a_p3_2", label: "¿A qué precio?", type: "text", condition: { field: "b6_gate", value: "Sí" } },
      { id: "b6_a_p4", label: "¿Por qué alguien debería elegirte a ti?", type: "text", condition: { field: "b6_gate", value: "Sí" } },
      { id: "b6_a_p5", label: "¿Qué parte de tu oferta todavía te cuesta explicar?", type: "text", condition: { field: "b6_gate", value: "Sí" } },
      
      // Camino B (No)
      { id: "b6_b_p1_1", label: "¿Qué oferta imaginas crear?", type: "text", condition: { field: "b6_gate", value: "No" } },
      { id: "b6_b_p1_2", label: "¿A quién ayudaría?", type: "text", condition: { field: "b6_gate", value: "No" } },
      { id: "b6_b_p2_1", label: "¿Qué problema resolvería?", type: "text", condition: { field: "b6_gate", value: "No" } },
      { id: "b6_b_p2_2", label: "¿Qué transformación promete?", type: "text", condition: { field: "b6_gate", value: "No" } },
      { id: "b6_b_p3", label: "¿Qué precio imaginas que tendría?", type: "text", condition: { field: "b6_gate", value: "No" } },
      { id: "b6_b_p4", label: "¿Qué te ha frenado de crearla hasta ahora?", type: "text", condition: { field: "b6_gate", value: "No" } },
      
      // Ejercicio (ambos)
      { id: "b6_ej1", label: "Ayudo a... (¿avatar?)", type: "text" },
      { id: "b6_ej2", label: "...a pasar de... (¿situación actual?)", type: "text" },
      { id: "b6_ej3", label: "...a... (¿resultado deseado?)", type: "text" },
      { id: "b6_ej4", label: "...mediante... (¿método/enfoque?)", type: "text" },
      { id: "b6_ej5", label: "...sin... (¿objeción principal?)", type: "text" }
    ]
  },
  {
    id: 7,
    title: "Comunicación",
    type: "questions",
    questions: [
      { id: "b7_p1", label: "¿En qué redes publicas?", type: "select", multiple: true, options: ["Instagram", "TikTok", "YouTube", "LinkedIn", "Facebook", "X (Twitter)", "Threads", "Otra", "No publico todavía"] },
      { id: "b7_p2", label: "¿Con qué frecuencia publicas?", type: "select", options: ["Todos los días", "Varias veces por semana", "1 vez por semana", "Esporádicamente", "No publico"] },
      { id: "b7_p3", label: "Tu contenido actual:", type: "select", options: ["Lleva a una oferta concreta", "A veces lleva a oferta", "Solo informa o inspira", "No tengo contenido aún"] },
      { id: "b7_p4", label: "¿Qué te cuesta más comunicar y qué temas evitas?", type: "text" },
      { id: "b7_p5", label: "¿Tienes una frase clara de posicionamiento? (Opcional)", type: "text" },
      { id: "b7_ej1", label: "Idea de contenido 1: Desde el dolor o miedo de tu avatar", type: "text" },
      { id: "b7_ej2", label: "Idea de contenido 2: Desde tu historia personal", type: "text" },
      { id: "b7_ej3", label: "Idea de contenido 3: Una que conecte con tu oferta", type: "text" }
    ]
  },
  {
    id: 8,
    title: "Entorno y sostén",
    type: "questions",
    questions: [
      { id: "b8_p1_1", label: "Personas o conversaciones que te expanden:", type: "text" },
      { id: "b8_p1_2", label: "Personas o conversaciones que te drenan:", type: "text" },
      { id: "b8_p2", label: "¿Tienes un espacio físico ordenado y una agenda que sostenga tu proyecto?", type: "select", options: ["Sí, ambos", "Tengo espacio pero no agenda", "Tengo agenda pero no espacio", "No tengo ninguno"] },
      { id: "b8_p2_exp", label: "Cuéntame brevemente qué falta:", type: "text", condition: { field: "b8_p2", value: ["Tengo espacio pero no agenda", "Tengo agenda pero no espacio", "No tengo ninguno"] } },
      { id: "b8_p3_1", label: "Hábito que necesito soltar:", type: "text" },
      { id: "b8_p3_2", label: "Hábito que necesito instalar:", type: "text" },
      { id: "b8_p4", label: "¿Qué tendrías que soltar (mental o externo) para expandirte?", type: "text" }
    ]
  },
  {
    id: 9,
    title: "Algo más (Opcional)",
    type: "questions",
    questions: [
      { id: "b9_p1", label: "¿Hay algo importante que quieras agregar antes de ver tus resultados? Puede ser un contexto, un miedo, una expectativa o algo que sientas que no pudiste expresar en los bloques anteriores.", type: "text" }
    ]
  }
];

