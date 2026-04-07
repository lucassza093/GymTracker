export const EXERCISE_GROUPS = {
  'Perna': [
    { id: 'leg-press', name: 'Leg Press', defaultWeight: 80 },
    { id: 'leg-press-ap', name: 'Leg Press A/P (#9)', defaultWeight: 50 },
    { id: 'panturrilha', name: 'Panturrilha', defaultWeight: 45 },
    { id: 'agachamento', name: 'Agachamento', defaultWeight: 17.5 },
    { id: 'flexora-10', name: 'Flexora (#10)', defaultWeight: 50 },
    { id: 'flexora-15', name: 'Flexora (#15)', defaultWeight: 10 },
    { id: 'flexora-ap', name: 'Flexora A/P', defaultWeight: 40 },
    { id: 'extensora', name: 'Extensora', defaultWeight: 90 },
    { id: 'abdutora', name: 'Abdutora', defaultWeight: 120 },
    { id: 'adutora', name: 'Adutora', defaultWeight: 90 },
    { id: 'elevacao', name: 'Elevação', defaultWeight: 25 },
    { id: 'sumo-livre', name: 'Sumô Livre', defaultWeight: 20 },
    { id: 'sumo-ap', name: 'Sumô A/P', defaultWeight: 20 },
  ],
  'Bíceps, Costas e Abdômen': [
    { id: 'remada-maq-30', name: 'Remada Máquina (#30)', defaultWeight: 100 },
    { id: 'remada-sent-62', name: 'Remada Sentado (#62)', defaultWeight: 55 },
    { id: 'remada-barra-t', name: 'Remada na Barra T', defaultWeight: 35 },
    { id: 'tronco-31', name: 'Tronco (#31)', defaultWeight: 30 },
    { id: 'tronco-33', name: 'Tronco (#33)', defaultWeight: 40 },
    { id: 'tronco-34', name: 'Tronco (#34)', defaultWeight: 45 },
    { id: 'costas-polia', name: 'Costas Polia Braço Esticado', defaultWeight: 12.5 },
    { id: 'banco-3-apoios', name: 'Banco 3 Apoios', defaultWeight: 17.5 },
    { id: 'barra-42', name: 'Barra (#42)', defaultWeight: 0 },
    { id: 'rosca-direta', name: 'Bíceps Rosca Direta', defaultWeight: 20 },
    { id: 'rosca-arnold', name: 'Bíceps 21 Arnold', defaultWeight: 17.5 },
    { id: 'martelo', name: 'Bíceps Martelo', defaultWeight: 9 },
    { id: 'rosca-inversa', name: 'Bíceps Rosca Inversa', defaultWeight: 15 },
    { id: 'banco-unilateral', name: 'Bíceps Banco Unilateral', defaultWeight: 10 },
    { id: 'rosca-barra-h', name: 'Bíceps Rosca Barra H', defaultWeight: 7.5 },
    { id: 'scott', name: 'Bíceps Scott', defaultWeight: 20 },
    { id: 'abdomen-40', name: 'Abdômen (#40)', defaultWeight: 30 },
    { id: 'abdomen-43', name: 'Abdômen (#43)', defaultWeight: 50 },
  ],
  'Peito, Ombro e Tríceps': [
    { id: 'supino', name: 'Supino', defaultWeight: 12.5 },
    { id: 'supino-maq-20', name: 'Supino Máquina (#20)', defaultWeight: 50 },
    { id: 'supino-22', name: 'Supino (#22)', defaultWeight: 25 },
    { id: 'supino-maq-24', name: 'Supino Máquina (#24)', defaultWeight: 20 },
    { id: 'tronco-25', name: 'Tronco (#25)', defaultWeight: 60 },
    { id: 'voador', name: 'Voador', defaultWeight: 9 },
    { id: 'peito-aberto-62', name: 'Peito Aberto (#62)', defaultWeight: 6.25 },
    { id: 'remada-alta', name: 'Remada Alta Barra', defaultWeight: 20 },
    { id: 'ombro-polia', name: 'Ombro Polia Corda por Baixo', defaultWeight: 3.75 },
    { id: 'desenv-halteres', name: 'Desenvolvimento c/ Halteres', defaultWeight: 9 },
    { id: 'triceps-polia-corda', name: 'Tríceps Polia Corda', defaultWeight: 7.5 },
    { id: 'triceps-61', name: 'Tríceps (#61)', defaultWeight: 35 },
    { id: 'biceps-inv-62', name: 'Bíceps Invertido (#62)', defaultWeight: 5 },
    { id: 'remada-62', name: 'Remada (#62)', defaultWeight: 6.5 },
    { id: 'palma', name: 'Palma', defaultWeight: 5 },
    { id: 'mao-frente', name: 'Mão p/ Frente Alternada', defaultWeight: 3 },
  ],
};

export const GROUP_ICONS = {
  'Perna': '🦵',
  'Bíceps, Costas e Abdômen': '💪',
  'Peito, Ombro e Tríceps': '🏋️',
};

export const ALL_GROUPS = Object.keys(EXERCISE_GROUPS);

export function getAllExercises() {
  return Object.values(EXERCISE_GROUPS).flat();
}

export function getExerciseById(id) {
  return getAllExercises().find(e => e.id === id);
}

export function getExercisesByGroup(group) {
  return EXERCISE_GROUPS[group] || [];
}
