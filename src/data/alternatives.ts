import type { PlanExercise } from '../logic/types'
import type { LibExercise } from './library'

export interface Alternative {
  exId: string
  name: string
  /** Wann diese Variante passt */
  why: string
  /** Abweichende Plan-Parameter (z. B. anderer Wiederholungsbereich) */
  adjust?: Partial<PlanExercise>
  /** Korrigierte Bibliotheksfelder (Fußball-Felder, deutscher Name) */
  fields?: Partial<LibExercise>
}

const jump: Partial<LibExercise> = { legsLoad: 'mittel', eccentricHeavy: false, ok2DaysBeforeGame: true }
const asWeight = (repMin: number, repMax: number, inc = 2.5): Partial<PlanExercise> => ({
  kind: 'weight', unit: 'kg', repMin, repMax, inc, variants: undefined,
})
const asHold = (repMin: number, repMax: number): Partial<PlanExercise> => ({
  kind: 'isometric', unit: 's', repMin, repMax, inc: 0, variants: undefined,
})

/**
 * Kuratierte Ausweichübungen pro Planübung – für den Fall, dass Gerät oder Platz fehlen.
 * Freitags-Alternativen sind nie exzentrisch schwer und nie „Belastung Beine: hoch“.
 */
export const ALTERNATIVES: Record<string, Alternative[]> = {
  Trap_Bar_Deadlift: [
    { exId: 'Barbell_Deadlift', name: 'Kreuzheben (Langhantel)', why: 'Keine Trap Bar: klassisch mit Langhantel, ca. 10 % leichter starten.' },
    { exId: 'Sumo_Deadlift', name: 'Sumo-Kreuzheben', why: 'Aufrechter Oberkörper, schont den unteren Rücken.' },
    { exId: 'Goblet_Squat', name: 'Goblet Squat', why: 'Keine Langhantel frei: Kurzhantel oder Kettlebell vor der Brust.', adjust: { repMin: 6, repMax: 8, inc: 2 } },
    { exId: 'Leg_Press', name: 'Beinpresse', why: 'Maschine statt freiem Gewicht, wenig Technikanspruch.', adjust: { repMin: 6, repMax: 8, inc: 5 } },
  ],
  'Barbell_Bench_Press_-_Medium_Grip': [
    { exId: 'Dumbbell_Bench_Press', name: 'Kurzhantel-Bankdrücken', why: 'Bank oder Stange belegt: Gewicht pro Hand eintragen.', adjust: { inc: 2 } },
    { exId: 'Smith_Machine_Bench_Press', name: 'Bankdrücken an der Multipresse', why: 'Geführte Stange, ohne Spotter sicher.' },
    { exId: 'Leverage_Chest_Press', name: 'Brustpresse (Maschine)', why: 'Keine Bank frei.' },
    { exId: 'Pushups', name: 'Liegestütze mit Zusatzgewicht', why: 'Gar kein Gerät: Weste oder Rucksack als Zusatzgewicht.', adjust: { repMin: 8, repMax: 12 } },
  ],
  Pullups: [
    { exId: 'Chin-Up', name: 'Klimmzüge im Untergriff', why: 'Gleiche Bewegung, etwas mehr Bizeps.' },
    { exId: 'Wide-Grip_Lat_Pulldown', name: 'Latzug breit', why: 'Kein Dip-Gürtel oder Stange: Gewicht am Kabelturm.', adjust: { repMin: 6, repMax: 8 } },
    { exId: 'Close-Grip_Front_Lat_Pulldown', name: 'Latzug eng', why: 'Alternative am Kabelturm mit engem Griff.', adjust: { repMin: 6, repMax: 8 } },
    { exId: 'Band_Assisted_Pull-Up', name: 'Klimmzüge mit Band-Unterstützung', why: 'Noch keine sauberen Klimmzüge mit Zusatzgewicht möglich.', adjust: { repMin: 6, repMax: 8, inc: 0 } },
    { exId: 'Inverted_Row', name: 'Rudern am Körpergewicht', why: 'Keine Klimmzugstange: Stange im Rack auf Hüfthöhe.', adjust: { repMin: 8, repMax: 12, inc: 0 } },
  ],
  'bulgarian-split-squat': [
    { exId: 'Split_Squat_with_Dumbbells', name: 'Split Squat mit Kurzhanteln', why: 'Keine Bank frei: hinterer Fuß am Boden.' },
    { exId: 'Dumbbell_Rear_Lunge', name: 'Ausfallschritt rückwärts (KH)', why: 'Kniefreundlicher als Ausfallschritte nach vorne.' },
    { exId: 'Dumbbell_Step_Ups', name: 'Step-ups mit Kurzhanteln', why: 'Wenig exzentrische Belastung, gut bei schweren Beinen.' },
    { exId: 'Smith_Single-Leg_Split_Squat', name: 'Split Squat an der Multipresse', why: 'Geführt, mehr Stabilität.', adjust: { inc: 2.5 } },
  ],
  'One-Arm_Dumbbell_Row': [
    { exId: 'Seated_One-arm_Cable_Pulley_Rows', name: 'Einarmiges Kabelrudern', why: 'Keine passenden Kurzhanteln frei.', adjust: { inc: 2.5 } },
    { exId: 'Bent_Over_Two-Dumbbell_Row', name: 'Vorgebeugtes KH-Rudern beidarmig', why: 'Keine Bank frei.' },
    { exId: 'T-Bar_Row_with_Handle', name: 'T-Bar-Rudern', why: 'Schwerer belastbar, beide Arme gleichzeitig.', adjust: { inc: 2.5, perSide: false } },
    { exId: 'Seated_Cable_Rows', name: 'Kabelrudern sitzend', why: 'Maschine statt freiem Gewicht.', adjust: { inc: 2.5, perSide: false } },
  ],
  'nordic-hamstring-curl': [
    { exId: 'Natural_Glute_Ham_Raise', name: 'Nordic mit Fixierung an Sprossenwand oder Langhantel', why: 'Kein Partner: Fersen unter gepolsterter Langhantel oder Sprossenwand fixieren.' },
    { exId: 'Glute_Ham_Raise', name: 'Glute-Ham-Raise (Gerät)', why: 'GHD-Gerät vorhanden: sehr ähnlicher Reiz.', adjust: asWeight(5, 8) },
    { exId: 'Lying_Leg_Curls', name: 'Beinbeuger liegend, 4 s ablassen', why: 'Keine Fixierung möglich: exzentrisch langsam an der Maschine.', adjust: asWeight(6, 8) },
    { exId: 'Seated_Leg_Curl', name: 'Beinbeuger sitzend, 4 s ablassen', why: 'Alternative Maschine, Hamstrings in Dehnung.', adjust: asWeight(6, 8) },
  ],
  'copenhagen-plank': [
    { exId: 'Side_Bridge', name: 'Seitstütz', why: 'Keine Bank frei: Rumpfstabilität ohne Adduktoren-Hebel.', adjust: asHold(20, 45) },
    { exId: 'band-hip-adduction-iso', name: 'Seitliches Adduktoren-Heben', why: 'Leichtere Leisten-Übung, gut bei Beschwerden.', adjust: asWeight(8, 12, 0) },
    { exId: 'Cable_Hip_Adduction', name: 'Adduktion am Kabelzug', why: 'Kabelzug mit Fußschlaufe vorhanden.', adjust: asWeight(10, 12) },
    { exId: 'Band_Hip_Adductions', name: 'Adduktion mit Band', why: 'Nur ein Band verfügbar.', adjust: asWeight(12, 15, 0) },
  ],
  Pallof_Press: [
    { exId: 'pallof-band', name: 'Pallof Press mit Band', why: 'Kabelzug belegt: Band an Rack oder Pfosten.', adjust: { inc: 0 } },
    { exId: 'Pallof_Press_With_Rotation', name: 'Pallof Press mit Rotation', why: 'Etwas anspruchsvoller, gleicher Aufbau.' },
    { exId: 'Standing_Cable_Wood_Chop', name: 'Holzhacker am Kabel', why: 'Rotation kontrolliert statt anti-rotatorisch.' },
    { exId: 'Side_Bridge', name: 'Seitstütz', why: 'Gar kein Gerät.', adjust: asHold(20, 45) },
  ],
  'countermovement-jump': [
    { exId: 'Freehand_Jump_Squat', name: 'Squat Jump (aus der Hocke)', why: 'Ohne Ausholbewegung, testet Startkraft.', fields: jump },
    { exId: 'Split_Jump', name: 'Split Jump', why: 'Einbeinig betonter, sprintnah.', fields: jump },
    { exId: 'Knee_Tuck_Jump', name: 'Tuck Jump', why: 'Wenig Platz: Knie zur Brust, reaktiv.', fields: jump },
  ],
  Standing_Long_Jump: [
    { exId: 'Side_Standing_Long_Jump', name: 'Seitlicher Standweitsprung', why: 'Wenig Platz nach vorn, trainiert Seitwärtsantritt.', fields: jump },
    { exId: 'Lateral_Bound', name: 'Seitliche Sprünge (Lateral Bound)', why: 'Einbeinig landen, gut für Richtungswechsel.', fields: { ...jump, focus: ['Knie', 'Sprunggelenk'] } },
    { exId: 'countermovement-jump', name: 'Countermovement Jump', why: 'Kein Platz für Weitsprünge.', adjust: { unit: 'cm' } },
  ],
  'med-ball-rotationswurf': [
    { exId: 'Medicine_Ball_Scoop_Throw', name: 'Med-Ball-Schaufelwurf', why: 'Keine Wand frei: Wurf nach vorn-oben.', fields: { nameDe: 'Med-Ball-Schaufelwurf' } },
    { exId: 'Standing_Cable_Wood_Chop', name: 'Holzhacker am Kabel (explosiv)', why: 'Kein Medizinball: schnell ziehen, langsam zurück.' },
    { exId: 'One-Arm_Medicine_Ball_Slam', name: 'Med-Ball-Slam einarmig', why: 'Ball darf nicht an die Wand.' },
    { exId: 'Medicine_Ball_Full_Twist', name: 'Med-Ball-Rotation', why: 'Wenig Platz: Rotation ohne Wurf.' },
  ],
  'trap-bar-jump': [
    { exId: 'dumbbell-jump', name: 'Sprünge mit Kurzhanteln', why: 'Keine Trap Bar: leichte Kurzhanteln seitlich halten.', adjust: { loadFrom: { pid: 'a-trapbar', pct: 0.1 }, inc: 2, note: 'Gewicht pro Hand' } },
    { exId: 'Freehand_Jump_Squat', name: 'Squat Jump ohne Gewicht', why: 'Kein Zusatzgewicht verfügbar: Höhe in cm loggen.', adjust: { loadFrom: undefined, unit: 'cm', inc: 0 }, fields: jump },
    { exId: 'countermovement-jump', name: 'Countermovement Jump', why: 'Einfachste Ausweichlösung.', adjust: { loadFrom: undefined, unit: 'cm', inc: 0 } },
  ],
  Incline_Dumbbell_Press: [
    { exId: 'Barbell_Incline_Bench_Press_-_Medium_Grip', name: 'Schrägbankdrücken (Langhantel)', why: 'Keine passenden Kurzhanteln.', adjust: { inc: 2.5 } },
    { exId: 'Smith_Machine_Incline_Bench_Press', name: 'Schrägbankdrücken an der Multipresse', why: 'Geführt, ohne Spotter.', adjust: { inc: 2.5 } },
    { exId: 'Leverage_Incline_Chest_Press', name: 'Schräge Brustpresse (Maschine)', why: 'Keine Schrägbank frei.', adjust: { inc: 2.5 } },
    { exId: 'Dumbbell_Bench_Press', name: 'Kurzhantel-Bankdrücken flach', why: 'Bank lässt sich nicht verstellen.' },
  ],
  Seated_Cable_Rows: [
    { exId: 'Wide-Grip_Lat_Pulldown', name: 'Latzug breit', why: 'Ruderstation belegt.' },
    { exId: 'Close-Grip_Front_Lat_Pulldown', name: 'Latzug eng', why: 'Ruderstation belegt.' },
    { exId: 'Bent_Over_Two-Dumbbell_Row', name: 'Vorgebeugtes KH-Rudern', why: 'Kein Kabelzug frei.', adjust: { inc: 2 } },
    { exId: 'Inverted_Row', name: 'Rudern am Körpergewicht', why: 'Gar kein Gerät frei.', adjust: { inc: 0 } },
  ],
  Standing_Military_Press: [
    { exId: 'Dumbbell_Shoulder_Press', name: 'Kurzhantel-Schulterdrücken', why: 'Keine Langhantel frei.', adjust: { inc: 2 } },
    { exId: 'Arnold_Dumbbell_Press', name: 'Arnold Press', why: 'Schulterfreundlicher mit Rotation.', adjust: { inc: 2 } },
    { exId: 'Machine_Shoulder_Military_Press', name: 'Schulterpresse (Maschine)', why: 'Unterer Rücken soll entlastet werden.' },
    { exId: 'Seated_Barbell_Military_Press', name: 'Schulterdrücken sitzend (Langhantel)', why: 'Weniger Rumpfanspruch.' },
  ],
  Face_Pull: [
    { exId: 'Band_Pull_Apart', name: 'Band Pull-Aparts', why: 'Kein Kabelzug frei.', adjust: { inc: 0, repMin: 15, repMax: 15 } },
    { exId: 'Reverse_Flyes', name: 'Reverse Flys (Kurzhantel)', why: 'Leichte Kurzhanteln, vorgebeugt.', adjust: { inc: 1 } },
    { exId: 'Reverse_Machine_Flyes', name: 'Reverse Butterfly (Maschine)', why: 'Butterfly-Maschine vorhanden.' },
    { exId: 'Cable_Rear_Delt_Fly', name: 'Reverse Flys am Kabel', why: 'Kein Seil-Griff vorhanden.' },
  ],
  'iso-single-leg-bridge': [
    { exId: 'iso-hamstring-hold', name: 'Isometrischer Hamstring-Hold', why: 'Hüfte bleibt näher am Boden, sanfter.' },
    { exId: 'Single_Leg_Glute_Bridge', name: 'Einbeinige Glute Bridge gehalten', why: 'Keine Bank frei: Fuß auf dem Boden.', adjust: asHold(20, 30) },
    { exId: 'Butt_Lift_Bridge', name: 'Glute Bridge gehalten (beidbeinig)', why: 'Bei Beschwerden: leichteste Stufe.', adjust: { ...asHold(30, 45), perSide: false } },
  ],
  Standing_Calf_Raises: [
    { exId: 'Standing_Dumbbell_Calf_Raise', name: 'Wadenheben einbeinig mit Kurzhantel', why: 'Keine Wadenmaschine.', adjust: { inc: 2, perSide: true } },
    { exId: 'Smith_Machine_Calf_Raise', name: 'Wadenheben an der Multipresse', why: 'Stange auf dem Rücken, Ballen auf einer Scheibe.' },
    { exId: 'Calf_Press_On_The_Leg_Press_Machine', name: 'Wadenheben an der Beinpresse', why: 'Beinpresse frei.', adjust: { inc: 5 } },
    { exId: 'Seated_Calf_Raise', name: 'Wadenheben sitzend', why: 'Betont den Soleus (wichtig für Sprints).' },
  ],
  Barbell_Deadlift: [
    { exId: 'Sumo_Deadlift', name: 'Sumo-Kreuzheben', why: 'Aufrechter Oberkörper, schont den unteren Rücken.' },
    { exId: 'Rack_Pull_with_Bands', name: 'Rack Pull', why: 'Kürzerer Weg, wenn der Boden-Start Probleme macht.' },
    { exId: 'Goblet_Squat', name: 'Goblet Squat', why: 'Keine Langhantel frei: Kurzhantel oder Kettlebell vor der Brust.', adjust: { repMin: 6, repMax: 8, inc: 2 } },
    { exId: 'Leg_Press', name: 'Beinpresse', why: 'Maschine statt freiem Gewicht, wenig Technikanspruch.', adjust: { repMin: 6, repMax: 8, inc: 5 } },
  ],
  Barbell_Full_Squat: [
    { exId: 'Front_Squat_Clean_Grip', name: 'Frontkniebeuge', why: 'Aufrechter, mehr Quadrizeps, weniger Rücken.' },
    { exId: 'Smith_Machine_Squat', name: 'Kniebeuge an der Multipresse', why: 'Kein freies Rack: geführte Stange.' },
    { exId: 'Hack_Squat', name: 'Hackenschmidt-Kniebeuge', why: 'Maschine, wenn die Langhantel belegt ist.' },
    { exId: 'Goblet_Squat', name: 'Goblet Squat', why: 'Nur Kurzhanteln verfügbar.', adjust: { repMin: 8, repMax: 10, inc: 2 } },
  ],
  'Barbell_Incline_Bench_Press_-_Medium_Grip': [
    { exId: 'Incline_Dumbbell_Press', name: 'Kurzhantel-Schrägbankdrücken', why: 'Langhantel belegt: Gewicht pro Hand.', adjust: { inc: 2 } },
    { exId: 'Smith_Machine_Incline_Bench_Press', name: 'Schrägbankdrücken an der Multipresse', why: 'Geführt, ohne Spotter.' },
    { exId: 'Leverage_Incline_Chest_Press', name: 'Schräge Brustpresse (Maschine)', why: 'Keine Schrägbank frei.' },
  ],
  'Lying_T-Bar_Row': [
    { exId: 'Seated_Cable_Rows', name: 'Kabelrudern sitzend', why: 'Brustgestützte Maschine belegt.', adjust: { inc: 2.5 } },
    { exId: 'Bent_Over_Two-Dumbbell_Row', name: 'Vorgebeugtes KH-Rudern', why: 'Kein Gerät frei.', adjust: { inc: 2 } },
    { exId: 'T-Bar_Row_with_Handle', name: 'T-Bar-Rudern', why: 'Ähnlicher Zug, ohne Brustauflage.', adjust: { inc: 2.5 } },
    { exId: 'Inverted_Row', name: 'Rudern am Körpergewicht', why: 'Gar kein Gerät frei.', adjust: { inc: 0 } },
  ],
  Barbell_Hip_Thrust: [
    { exId: 'Barbell_Glute_Bridge', name: 'Glute Bridge (Langhantel)', why: 'Keine Bank frei: vom Boden aus.' },
    { exId: 'Single_Leg_Glute_Bridge', name: 'Einbeinige Glute Bridge', why: 'Kein Gewicht frei, einbeinig schwerer.', adjust: { inc: 2.5, perSide: true } },
    { exId: 'Butt_Lift_Bridge', name: 'Glute Bridge beidbeinig', why: 'Leichteste Stufe bei Beschwerden.', adjust: { inc: 2.5 } },
    { exId: 'Glute_Kickback', name: 'Glute Kickback', why: 'Kabelzug statt Langhantel.', adjust: { inc: 2.5, perSide: true } },
  ],
  Thigh_Adductor: [
    { exId: 'Cable_Hip_Adduction', name: 'Adduktion am Kabelzug', why: 'Maschine belegt: Kabelzug mit Fußschlaufe.', adjust: { perSide: true } },
    { exId: 'Band_Hip_Adductions', name: 'Adduktion mit Band', why: 'Nur ein Band verfügbar.', adjust: { inc: 0, perSide: true } },
    { exId: 'band-hip-adduction-iso', name: 'Seitliches Adduktoren-Heben', why: 'Ohne Gerät, gut bei Leistenbeschwerden.', adjust: { inc: 0, kind: 'weight', unit: 'kg', repMin: 8, repMax: 12 } },
  ],
  Side_Lateral_Raise: [
    { exId: 'Cable_Seated_Lateral_Raise', name: 'Seitheben am Kabel', why: 'Durchgehende Spannung, Kurzhanteln belegt.', adjust: { inc: 1 } },
    { exId: 'Lateral_Raise_-_With_Bands', name: 'Seitheben mit Band', why: 'Nur ein Band verfügbar.', adjust: { inc: 0 } },
    { exId: 'Seated_Side_Lateral_Raise', name: 'Seitheben sitzend', why: 'Weniger Schwung aus den Beinen.' },
  ],
  Dumbbell_Bicep_Curl: [
    { exId: 'Barbell_Curl', name: 'Langhantel-Curls', why: 'Kurzhanteln belegt.', adjust: { inc: 2.5 } },
    { exId: 'Standing_Biceps_Cable_Curl', name: 'Bizeps-Curl am Kabel', why: 'Gleichmäßige Spannung.', adjust: { inc: 2.5 } },
    { exId: 'Machine_Bicep_Curl', name: 'Bizeps-Maschine', why: 'Gerät statt freies Gewicht.', adjust: { inc: 2.5 } },
    { exId: 'Alternate_Hammer_Curl', name: 'Hammer-Curls', why: 'Betont den Unterarm, handgelenksfreundlich.' },
  ],
  'Dips_-_Triceps_Version': [
    { exId: 'Weighted_Bench_Dip', name: 'Bank-Dips mit Gewicht', why: 'Kein Dip-Gerät: Hände auf der Bank, Gewicht auf den Oberschenkeln.' },
    { exId: 'Close-Grip_Barbell_Bench_Press', name: 'Enges Bankdrücken', why: 'Trizeps und Brust ohne Dip-Station.', adjust: { repMin: 6, repMax: 8 } },
    { exId: 'Bench_Dips', name: 'Bank-Dips', why: 'Gar kein Gerät.', adjust: { repMin: 10, repMax: 15, inc: 0 } },
    { exId: 'Pushups', name: 'Liegestütze mit Zusatzgewicht', why: 'Weste oder Rucksack als Zusatzgewicht.', adjust: { repMin: 8, repMax: 12 } },
  ],
  'Wide-Grip_Lat_Pulldown': [
    { exId: 'Close-Grip_Front_Lat_Pulldown', name: 'Latzug eng', why: 'Breite Stange belegt.' },
    { exId: 'Chin-Up', name: 'Klimmzüge im Untergriff', why: 'Kein Kabelturm frei.', adjust: { inc: 2.5, repMin: 6, repMax: 8 } },
    { exId: 'Seated_Cable_Rows', name: 'Kabelrudern sitzend', why: 'Latzug belegt.' },
    { exId: 'Bent_Over_Two-Dumbbell_Row', name: 'Vorgebeugtes KH-Rudern', why: 'Kein Kabelzug frei.', adjust: { inc: 2 } },
  ],
  'skater-jump': [
    { exId: 'Lateral_Bound', name: 'Seitliche Sprünge (Lateral Bound)', why: 'Weniger Platz, gleicher Reiz.', fields: jump },
    { exId: 'Side_Standing_Long_Jump', name: 'Seitlicher Standweitsprung', why: 'Beidbeinig statt einbeinig landen.', fields: jump },
    { exId: 'Split_Jump', name: 'Split Jump', why: 'Sprintnah, auf der Stelle.', fields: jump, adjust: { unit: 'cm' } },
  ],
  'speed-squat': [
    { exId: 'Weighted_Jump_Squat', name: 'Jump Squat mit Last', why: 'Gleiches Ziel: schnelle Kraftentwicklung.', fields: jump },
    { exId: 'Freehand_Jump_Squat', name: 'Squat Jump ohne Gewicht', why: 'Keine Langhantel frei: Höhe in cm loggen.', fields: jump, adjust: { loadFrom: undefined, unit: 'cm', inc: 0, speed: undefined } },
    { exId: 'countermovement-jump', name: 'Countermovement Jump', why: 'Einfachste Ausweichlösung.', adjust: { loadFrom: undefined, unit: 'cm', inc: 0, speed: undefined } },
  ],
  Standing_Cable_Wood_Chop: [
    { exId: 'Pallof_Press_With_Rotation', name: 'Pallof Press mit Rotation', why: 'Kabel belegt oder Rotation kontrollierter.', adjust: { kind: 'weight', repMin: 8, repMax: 10, rpe: 8 } },
    { exId: 'Cable_Russian_Twists', name: 'Russian Twists am Kabel', why: 'Rotation am Kabelzug, ruhiger.', adjust: { repMin: 8, repMax: 10 } },
    { exId: 'Russian_Twist', name: 'Russian Twists', why: 'Gar kein Gerät: mit Gewichtsscheibe.', adjust: { repMin: 8, repMax: 10 } },
  ],
  Romanian_Deadlift: [
    { exId: 'Stiff-Legged_Dumbbell_Deadlift', name: 'Rumänisches Kreuzheben (Kurzhanteln)', why: 'Keine Langhantel frei.', adjust: { inc: 2 } },
    { exId: 'Kettlebell_One-Legged_Deadlift', name: 'Einbeiniges Kreuzheben (KB/KH)', why: 'Leichtere Last, mehr Stabilität gefordert.', adjust: { inc: 2, perSide: true } },
    { exId: 'Smith_Machine_Stiff-Legged_Deadlift', name: 'Rumänisches Kreuzheben an der Multipresse', why: 'Geführt.' },
  ],
}

/** Deutsche Namen und korrigierte Felder für alle Alternativen */
export function alternativeFields(): Record<string, Partial<LibExercise>> {
  const out: Record<string, Partial<LibExercise>> = {}
  for (const list of Object.values(ALTERNATIVES)) {
    for (const a of list) out[a.exId] = { nameDe: out[a.exId]?.nameDe ?? a.name, ...out[a.exId], ...a.fields }
  }
  return out
}

/** Pflichtübungen: dürfen nur für eine Einheit getauscht werden */
export const PROTECTED = new Set(['nordic-hamstring-curl', 'copenhagen-plank'])

/** Original-Übung einer (evtl. schon getauschten) Planübung */
export const baseExId = (ex: Pick<PlanExercise, 'exId' | 'orig'>): string => ex.orig?.exId ?? ex.exId
export const basePid = (pid: string): string => pid.split('@')[0]

export function alternativesFor(ex: Pick<PlanExercise, 'exId' | 'orig'>): Alternative[] {
  return ALTERNATIVES[baseExId(ex)] ?? []
}

/**
 * Tauscht eine Planübung gegen eine Alternative. Sätze, Pausen und Kategorie bleiben,
 * Wiederholungsschema/Einheit kommen aus `adjust`. Jede Alternative bekommt eine
 * eigene pid (`<basis>@<exId>`), damit ihre Progression getrennt läuft.
 */
export function applyAlternative(ex: PlanExercise, alt: Alternative): PlanExercise {
  const orig = restoreOriginal(ex)
  if (alt.exId === orig.exId) return orig
  return {
    ...orig,
    // eigener Wiederholungsbereich ersetzt die Kraftblock-Überschreibung
    ...(alt.adjust?.repMin !== undefined ? { kraft: undefined } : {}),
    ...alt.adjust,
    exId: alt.exId,
    name: alt.name,
    orig,
    pid: `${orig.pid}@${alt.exId}`,
  }
}

/** Macht einen Tausch rückgängig */
export function restoreOriginal(ex: PlanExercise): PlanExercise {
  if (!ex.orig) return ex
  return { ...ex.orig }
}
