export function calculateCapa1(answers: Record<string, any>) {
  // Flatten answers because they are divided by block using block_1, block_2...
  let flatAnswers: Record<string, any> = {};
  for (const blockKey of Object.keys(answers)) {
    if (blockKey.startsWith("block_")) {
      flatAnswers = { ...flatAnswers, ...answers[blockKey] };
    }
  }

  // Helper to extract text points loosely (defaults to 3 prior to AI processing)
  const getQualitativeScore = (val: any) => {
    if (!val || typeof val !== 'string' || val.trim().length === 0) return 1;
    const len = val.trim().length;
    if (len < 10) return 1;
    if (len < 50) return 2;
    if (len < 150) return 3;
    if (len < 300) return 4;
    return 5;
  };

  const getMultiTextScore = (keys: string[]) => {
    if (keys.length === 0) return 1;
    const total = keys.reduce((sum, key) => sum + getQualitativeScore(flatAnswers[key]), 0);
    return total / keys.length;
  };

  // AE (Autoridad y Experiencia)
  let ae = 0;
  const b1_p2 = flatAnswers["b1_p2"];
  if (b1_p2 === "Menos de 1 año") ae += 1 * 0.20;
  else if (b1_p2 === "1-2 años") ae += 2 * 0.20;
  else if (b1_p2 === "3-5 años") ae += 3 * 0.20;
  else if (b1_p2 === "6-10 años") ae += 4 * 0.20;
  else if (b1_p2 === "Más de 10 años") ae += 5 * 0.20;
  else ae += 1 * 0.20;

  const b1_p3 = flatAnswers["b1_p3"];
  if (b1_p3 === "Aún no he ayudado a nadie con esto") ae += 1 * 0.25;
  else if (b1_p3 === "Sí, pero solo de forma informal") ae += 3 * 0.25;
  else if (b1_p3 === "Sí, con casos y resultados concretos") ae += 5 * 0.25;
  else ae += 1 * 0.25;

  const b1_p4 = flatAnswers["b1_p4"];
  if (b1_p4 === "No lo monetizo todavía") ae += 1 * 0.30;
  else if (b1_p4 === "Lo hago como complemento de otros ingresos") ae += 3 * 0.30;
  else if (b1_p4 === "Vivo de esto") ae += 5 * 0.30;
  else ae += 1 * 0.30;

  ae += getQualitativeScore(flatAnswers["b1_p3_exp"]) * 0.25;

  // SE (Seguridad para Exponerse)
  let se = 0;
  const b2Scales = [
    Number(flatAnswers["b2_s1"]) || 1,
    Number(flatAnswers["b2_s2"]) || 1,
    Number(flatAnswers["b2_s3"]) || 1,
    Number(flatAnswers["b2_s4"]) || 1,
    Number(flatAnswers["b2_s5"]) || 1
  ];
  const b2ScaleAvg = b2Scales.reduce((a, b) => a + b, 0) / 5;
  se += b2ScaleAvg * 0.50;
  
  // Análisis IA carga emocional B2 Parte A
  se += getMultiTextScore(["b2_p1", "b2_p2"]) * 0.25; 
  
  const b3_p4 = Array.isArray(flatAnswers["b3_p4"]) ? flatAnswers["b3_p4"].length : (flatAnswers["b3_p4"] ? 1 : 0);
  if (b3_p4 === 0) se += 5 * 0.25;
  else if (b3_p4 <= 2) se += 4 * 0.25;
  else if (b3_p4 <= 4) se += 3 * 0.25;
  else if (b3_p4 <= 6) se += 2 * 0.25;
  else se += 1 * 0.25;

  // CI (Claridad de Identidad)
  let ci = (
    getMultiTextScore(["b4_p1", "b4_p2"]) * 0.35 +
    getMultiTextScore(["b4_p3", "b4_p4"]) * 0.25 +
    getQualitativeScore(flatAnswers["b4_p5"]) * 0.20 +
    getMultiTextScore(["b4_ej1", "b4_ej2", "b4_ej3", "b4_ej4"]) * 0.20
  );

  // CA (Claridad de Avatar)
  let ca = (
    getQualitativeScore(flatAnswers["b5_p1"]) * 0.25 +
    getQualitativeScore(flatAnswers["b5_p2"]) * 0.25 +
    getMultiTextScore(["b5_p3_1", "b5_p3_2"]) * 0.20 +
    getMultiTextScore(["b5_p4", "b5_p5"]) * 0.30
  );

  // CO (Claridad de Oferta)
  let co = 0;
  const b6_gate = flatAnswers["b6_gate"];
  if (b6_gate === "No") {
    co = Math.min(3.0, getMultiTextScore(["b6_b_p1_1", "b6_b_p1_2", "b6_b_p2_1", "b6_b_p2_2"]) * 0.6);
  } else {
    co = (
      getMultiTextScore(["b6_a_p1_1", "b6_a_p1_2", "b6_a_p2_1"]) * 0.50 +
      getMultiTextScore(["b6_a_p3_1", "b6_a_p3_2"]) * 0.20 +
      getQualitativeScore(flatAnswers["b6_a_p4"]) * 0.15 +
      getMultiTextScore(["b6_ej1", "b6_ej2", "b6_ej3", "b6_ej4", "b6_ej5"]) * 0.15
    );
  }

  // CC (Comunicación Estratégica)
  let cc = 0;
  const b7_p2 = flatAnswers["b7_p2"];
  if (b7_p2 === "No publico") cc += 1 * 0.20;
  else if (b7_p2 === "Esporádicamente") cc += 2 * 0.20;
  else if (b7_p2 === "1 vez por semana") cc += 3 * 0.20;
  else if (b7_p2 === "Varias veces por semana") cc += 4 * 0.20;
  else if (b7_p2 === "Todos los días") cc += 5 * 0.20;
  else cc += 1 * 0.20;

  const b7_p3 = flatAnswers["b7_p3"];
  if (b7_p3 === "Solo informa o inspira" || b7_p3 === "No tengo contenido aún") cc += 1 * 0.30;
  else if (b7_p3 === "A veces lleva a oferta") cc += 3 * 0.30;
  else if (b7_p3 === "Lleva a una oferta concreta") cc += 5 * 0.30;
  else cc += 1 * 0.30;

  cc += getQualitativeScore(flatAnswers["b7_p4"]) * 0.15; // Cuesta comunicar
  cc += getQualitativeScore(flatAnswers["b7_p5"]) * 0.20; // Frase posicionamiento
  cc += getMultiTextScore(["b7_ej1", "b7_ej2", "b7_ej3"]) * 0.15; // 3 ideas (ej1-ej3)

  // SV (Sistema de Ventas)
  let sv = 0;
  sv += getQualitativeScore(flatAnswers["b6_a_p3_1"]) * 0.35; // Proceso repetible infiere IA
  
  if (b7_p3 === "Lleva a una oferta concreta") sv += 5 * 0.35;
  else if (b7_p3 === "A veces lleva a oferta") sv += 3 * 0.35;
  else sv += 1 * 0.35;
  
  // Producto digital vs servicio
  const b6_p3_1 = (flatAnswers["b6_a_p3_1"] || "").toLowerCase();
  if (b6_p3_1.includes("digital") || b6_p3_1.includes("curso")) sv += 5 * 0.30;
  else if (b6_p3_1.includes("ambos") || b6_p3_1.includes("híbrido")) sv += 4 * 0.30;
  else if (b6_p3_1.includes("servicio") || b6_p3_1.includes("1a1")) sv += 2 * 0.30;
  else sv += 3 * 0.30;

  if (b6_gate === "No") sv = 1;

  // ES (Entorno y Sostén)
  let es = 0;
  es += getMultiTextScore(["b8_p1_1", "b8_p1_2"]) * 0.30; // Entorno (P1)
  
  const b8_p2 = flatAnswers["b8_p2"];
  if (b8_p2 === "Sí, ambos") es += 5 * 0.25;
  else if (b8_p2 === "Tengo espacio pero no agenda" || b8_p2 === "Tengo agenda pero no espacio") es += 3 * 0.25;
  else if (b8_p2 === "No tengo ninguno") es += 1 * 0.25;
  else es += 3 * 0.25;

  es += getMultiTextScore(["b8_p3_1", "b8_p3_2"]) * 0.25; // Hábitos (P3)
  es += getQualitativeScore(flatAnswers["b8_p4"]) * 0.20; // Soltar (P4)

  return {
    AE: Number(ae.toFixed(2)),
    SE: Number(se.toFixed(2)),
    CI: Number(ci.toFixed(2)),
    CA: Number(ca.toFixed(2)),
    CO: Number(co.toFixed(2)),
    CC: Number(cc.toFixed(2)),
    SV: Number(sv.toFixed(2)),
    ES: Number(es.toFixed(2))
  };
}

export function calculateCapa2(scores: Record<string, number>) {
  const vectors = [
    { name: "Experto oculto", vec: { AE: 4.5, SE: 1.5, CI: 2.5, CA: 2.5, CO: 1.5, CC: 1.5, SV: 1.5, ES: 3.0 }, def: ["SE"] },
    { name: "Experto disperso", vec: { AE: 3.5, SE: 3.5, CI: 1.5, CA: 1.5, CO: 1.5, CC: 2.5, SV: 1.5, ES: 3.0 }, def: ["CI", "CA"] },
    { name: "Experto técnico", vec: { AE: 4.5, SE: 3.5, CI: 3.5, CA: 1.5, CO: 2.5, CC: 1.5, SV: 2.5, ES: 3.0 }, def: ["CA", "CC"] },
    { name: "Audiencia sin conversión", vec: { AE: 3.5, SE: 3.5, CI: 3.5, CA: 3.5, CO: 2.5, CC: 4.5, SV: 1.5, ES: 3.0 }, def: ["CC", "SV"] },
    { name: "Oferta sin sistema", vec: { AE: 4.5, SE: 3.5, CI: 4.5, CA: 3.5, CO: 4.5, CC: 3.5, SV: 1.5, ES: 3.0 }, def: ["CO", "SV"] },
    { name: "Listo autosaboteado", vec: { AE: 4.5, SE: 1.5, CI: 4.5, CA: 4.5, CO: 4.5, CC: 3.5, SV: 3.0, ES: 1.5 }, def: ["SE", "ES"] }
  ];

  const maxPossibleDist = Math.sqrt(
    8 * Math.pow(4, 2) + 2 * Math.pow(4, 2) // Rough max distance (we allow double weight for def vars)
  ); 

  const affinities = vectors.map(profile => {
    let sumDistSq = 0;
    let maxTheoreticalSq = 0;
    for (const key of Object.keys(profile.vec) as (keyof typeof scores)[]) {
      const weight = profile.def.includes(key) ? 2 : 1;
      const diff = scores[key] - profile.vec[key];
      sumDistSq += (diff * diff) * weight;
      
      const maxDiff = Math.max(Math.abs(5 - profile.vec[key]), Math.abs(1 - profile.vec[key]));
      maxTheoreticalSq += (maxDiff * maxDiff) * weight;
    }
    
    const dist = Math.sqrt(sumDistSq);
    const maxDist = Math.sqrt(maxTheoreticalSq);
    
    let affinity = 100 - ((dist / maxDist) * 100);
    if (affinity < 0) affinity = 0;
    if (affinity > 100) affinity = 100;

    return {
      name: profile.name,
      affinity: Number(affinity.toFixed(2))
    };
  });

  return affinities.sort((a, b) => b.affinity - a.affinity);
}

export function extractTextAnswers(answers: Record<string, any>) {
  let flatAnswers: Record<string, any> = {};
  for (const blockKey of Object.keys(answers)) {
    if (blockKey.startsWith("block_")) {
      flatAnswers = { ...flatAnswers, ...answers[blockKey] };
    }
  }

  let text = "";
  for (const [key, value] of Object.entries(flatAnswers)) {
    if (typeof value === "string") {
      text += `[${key}]: ${value}\n`;
    }
  }
  return text;
}
