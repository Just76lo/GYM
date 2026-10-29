import raw from './exdb.json'

export type LibCategory = 'Kraft' | 'Schnellkraft/Plyometrie' | 'Prävention' | 'Mobility' | 'Rumpf'
export type Load = 'niedrig' | 'mittel' | 'hoch'
export type Focus = 'Hamstrings' | 'Leiste' | 'Knie' | 'Sprunggelenk'

export const LIB_CATEGORIES: LibCategory[] = ['Kraft', 'Schnellkraft/Plyometrie', 'Prävention', 'Mobility', 'Rumpf']
export const FOCI: Focus[] = ['Hamstrings', 'Leiste', 'Knie', 'Sprunggelenk']

export interface LibExercise {
  id: string
  nameEn: string
  nameDe?: string
  level: string
  equipment: string
  primary: string[]
  secondary: string[]
  category: LibCategory
  images: string[]
  instrDe?: string[]
  instrEn?: string[]
  mistakesDe?: string[]
  legsLoad: Load
  eccentricHeavy: boolean
  ok2DaysBeforeGame: boolean
  focus: Focus[]
  needsBox: boolean
  source: 'free-exercise-db' | 'ergänzt' | 'eigene'
  ytQuery?: string
}

interface RawEx {
  id: string
  name: string
  level: string
  equipment: string | null
  primaryMuscles: string[]
  secondaryMuscles: string[]
  category: string
  images: string[]
  instructions: string[]
}

export const MUSCLE_DE: Record<string, string> = {
  abdominals: 'Bauch', abductors: 'Abduktoren', adductors: 'Adduktoren', biceps: 'Bizeps', calves: 'Waden',
  chest: 'Brust', forearms: 'Unterarme', glutes: 'Gesäß', hamstrings: 'Oberschenkelrückseite', lats: 'Latissimus',
  'lower back': 'Unterer Rücken', 'middle back': 'Mittlerer Rücken', neck: 'Nacken', quadriceps: 'Quadrizeps',
  shoulders: 'Schultern', traps: 'Trapez', triceps: 'Trizeps',
}
export const EQUIP_DE: Record<string, string> = {
  barbell: 'Langhantel', dumbbell: 'Kurzhantel', 'body only': 'Körpergewicht', cable: 'Kabelzug', machine: 'Maschine',
  kettlebells: 'Kettlebell', bands: 'Band', 'medicine ball': 'Medizinball', 'exercise ball': 'Gymnastikball',
  'foam roll': 'Faszienrolle', 'e-z curl bar': 'SZ-Stange', other: 'Sonstiges', none: 'Keins',
}
export const LEVEL_DE: Record<string, string> = { beginner: 'Anfänger', intermediate: 'Fortgeschritten', expert: 'Experte' }
export const muscleDe = (m: string) => MUSCLE_DE[m] ?? m
export const equipDe = (e: string) => EQUIP_DE[e] ?? e

const BOX_RE = /box jump|depth jump|bench jump|box skip|box shuffle|seated box jump/i
export const BOX_ALTERNATIVES = [
  'Countermovement Jumps (ohne Box)',
  'Trap-Bar-Sprünge',
  'Standweitsprung',
  'Split Jump / Squat Jump am Boden',
]
const ECC_RE = /romanian|stiff|good morning|lunge|split squat|deficit|nordic|glute.?ham|leg curl|deadlift|hamstring slide|squat/i

function categoryOf(r: RawEx): LibCategory {
  if (r.category === 'stretching') return 'Mobility'
  if (r.category === 'plyometrics') return 'Schnellkraft/Plyometrie'
  if (r.primaryMuscles.includes('abdominals') && r.category === 'strength') return 'Rumpf'
  return 'Kraft'
}

function loadOf(r: RawEx, cat: LibCategory): Load {
  if (cat === 'Mobility' || cat === 'Rumpf') return 'niedrig'
  const legs = r.primaryMuscles.some((m) => ['quadriceps', 'hamstrings', 'glutes', 'adductors', 'abductors'].includes(m))
  if (cat === 'Schnellkraft/Plyometrie') return legs ? 'hoch' : 'niedrig'
  if (!legs) return r.primaryMuscles.includes('calves') ? 'mittel' : 'niedrig'
  return ['barbell', 'kettlebells', 'other'].includes(r.equipment ?? '') ? 'hoch' : 'mittel'
}

function fromRaw(r: RawEx): LibExercise {
  const category = categoryOf(r)
  const legsLoad = loadOf(r, category)
  const eccentric = category !== 'Mobility' && category !== 'Rumpf' && ECC_RE.test(r.name) && legsLoad !== 'niedrig'
  const focus: Focus[] = []
  if (r.primaryMuscles.includes('hamstrings') && category !== 'Mobility') focus.push('Hamstrings')
  if (r.primaryMuscles.includes('adductors') && category !== 'Mobility') focus.push('Leiste')
  if (r.primaryMuscles.includes('calves') && category !== 'Mobility') focus.push('Sprunggelenk')
  return {
    id: r.id,
    nameEn: r.name,
    level: r.level,
    equipment: r.equipment ?? 'none',
    primary: r.primaryMuscles,
    secondary: r.secondaryMuscles,
    category,
    images: r.images,
    instrEn: r.instructions,
    legsLoad,
    eccentricHeavy: eccentric,
    ok2DaysBeforeGame: legsLoad === 'niedrig' || (legsLoad === 'mittel' && !eccentric),
    focus,
    needsBox: BOX_RE.test(r.name),
    source: 'free-exercise-db',
  }
}

type Over = Partial<Omit<LibExercise, 'id'>>

/** Deutsche Texte und Fußball-Felder für die Übungen aus dem Plan */
const OVERRIDES: Record<string, Over> = {
  Trap_Bar_Deadlift: {
    nameDe: 'Trap-Bar-Kreuzheben', category: 'Kraft', legsLoad: 'hoch', eccentricHeavy: false, ok2DaysBeforeGame: false,
    instrDe: [
      'In die Mitte der Trap Bar treten, Füße hüftbreit, Griffe seitlich greifen.',
      'Hüfte nach hinten schieben, Brust raus, Rücken lang, Spannung im Latissimus aufbauen.',
      'Mit den Beinen den Boden wegdrücken, Hüfte und Schultern steigen gleichzeitig.',
      'Oben Gesäß anspannen, nicht ins Hohlkreuz überstrecken. Kontrolliert ablegen.',
    ],
    mistakesDe: ['Rundrücken beim Anheben', 'Hüfte schießt zuerst hoch', 'Stange wird abgerissen statt Spannung aufgebaut', 'Überstreckung am Ende'],
  },
  'Barbell_Bench_Press_-_Medium_Grip': {
    nameDe: 'Bankdrücken (Langhantel)', legsLoad: 'niedrig', eccentricHeavy: false, ok2DaysBeforeGame: true,
    instrDe: [
      'Schulterblätter zusammenziehen und nach unten, Füße fest am Boden, leichte Brückenspannung.',
      'Stange kontrolliert zur unteren Brust senken, Unterarme bleiben senkrecht.',
      'Explosiv nach oben drücken, Handgelenke gerade.',
    ],
    mistakesDe: ['Schultern rollen nach vorn', 'Stange federt auf der Brust', 'Ellbogen zu weit nach außen (90°)', 'Gesäß hebt ab'],
  },
  Pullups: {
    nameDe: 'Klimmzüge', legsLoad: 'niedrig', eccentricHeavy: false, ok2DaysBeforeGame: true,
    instrDe: [
      'Obergriff schulterbreit, aus dem Schulterhang starten (Schulterblätter nach unten ziehen).',
      'Brust zur Stange ziehen, Ellbogen zu den Hüften.',
      'Oben Kinn über der Stange, kontrolliert ablassen bis fast gestreckte Arme.',
    ],
    mistakesDe: ['Schwung aus den Beinen (Kipping)', 'Nicht voll ablassen', 'Schultern zu den Ohren gezogen'],
  },
  'One-Arm_Dumbbell_Row': {
    nameDe: 'Einarmiges Kurzhantelrudern', legsLoad: 'niedrig', eccentricHeavy: false, ok2DaysBeforeGame: true,
    instrDe: ['Eine Hand und ein Knie auf der Bank, Rücken gerade.', 'Hantel zur Hüfte ziehen, Ellbogen nah am Körper.', 'Unten die Schulter leicht dehnen, ohne den Oberkörper zu drehen.'],
    mistakesDe: ['Oberkörper dreht auf', 'Hantel wird nur mit dem Bizeps gehoben', 'Zu viel Schwung'],
  },
  Pallof_Press: {
    nameDe: 'Pallof Press', category: 'Rumpf', legsLoad: 'niedrig', eccentricHeavy: false, ok2DaysBeforeGame: true,
    instrDe: ['Seitlich zum Kabel stehen, Griff vor der Brust halten.', 'Arme gerade nach vorn drücken, Rumpf dreht nicht mit.', 'Kurz halten, zurückführen.'],
    mistakesDe: ['Oberkörper rotiert zum Kabel', 'Hohlkreuz', 'Zu schnelle Ausführung'],
  },
  Standing_Long_Jump: {
    nameDe: 'Standweitsprung', legsLoad: 'mittel', eccentricHeavy: false, ok2DaysBeforeGame: false,
    instrDe: ['Hüftbreiter Stand, Arme schwingen zurück.', 'Explosiv Arme und Hüfte nach vorn werfen, weit springen.', 'Sauber und stabil landen, Weite messen.'],
    mistakesDe: ['Landung mit durchgestreckten Knien', 'Knie fallen nach innen', 'Nicht stabil gelandet gemessen'],
  },
  Incline_Dumbbell_Press: {
    nameDe: 'Kurzhantel-Schrägbankdrücken', legsLoad: 'niedrig', eccentricHeavy: false, ok2DaysBeforeGame: true,
    instrDe: ['Bank auf ca. 30°, Schulterblätter fixieren.', 'Hanteln kontrolliert zur oberen Brust senken.', 'Nach oben drücken, Hanteln leicht zusammenführen.'],
    mistakesDe: ['Bank zu steil (wird zum Schulterdrücken)', 'Ellbogen zu weit außen', 'Hanteln fallen nach unten ohne Kontrolle'],
  },
  Seated_Cable_Rows: {
    nameDe: 'Kabelrudern sitzend', legsLoad: 'niedrig', eccentricHeavy: false, ok2DaysBeforeGame: true,
    instrDe: ['Aufrecht sitzen, Brust raus.', 'Griff zum Bauchnabel ziehen, Schulterblätter zusammen.', 'Kontrolliert zurückführen, Rücken bleibt gerade.'],
    mistakesDe: ['Oberkörper schwingt', 'Schultern hochgezogen'],
  },
  Standing_Military_Press: {
    nameDe: 'Schulterdrücken stehend', legsLoad: 'niedrig', eccentricHeavy: false, ok2DaysBeforeGame: true,
    instrDe: ['Gesäß und Bauch fest, Stange auf den Schlüsselbeinen.', 'Kopf kurz zurück, Stange senkrecht über die Mitte drücken.', 'Oben Kopf durch die Arme, Rippen unten lassen.'],
    mistakesDe: ['Hohlkreuz', 'Stange weit vor dem Körper', 'Beinschwung'],
  },
  Face_Pull: {
    nameDe: 'Face Pulls', category: 'Prävention', legsLoad: 'niedrig', eccentricHeavy: false, ok2DaysBeforeGame: true,
    instrDe: ['Seil auf Gesichtshöhe.', 'Zum Gesicht ziehen, Ellbogen hoch, Hände auseinander.', 'Hinten kurz halten, Schulterblätter zusammen.'],
    mistakesDe: ['Zu schwer, Oberkörper lehnt zurück', 'Ellbogen hängen unten'],
  },
  Standing_Calf_Raises: {
    nameDe: 'Wadenheben stehend', category: 'Prävention', focus: ['Sprunggelenk'], legsLoad: 'niedrig', eccentricHeavy: false, ok2DaysBeforeGame: true,
    instrDe: ['Ballen auf der Kante, Fersen tief.', 'Vollständig hochdrücken, oben 1 s halten.', 'Langsam in die Dehnung senken.'],
    mistakesDe: ['Halbe Bewegung', 'Federn am unteren Punkt'],
  },
  Romanian_Deadlift: {
    nameDe: 'Rumänisches Kreuzheben', legsLoad: 'hoch', eccentricHeavy: true, ok2DaysBeforeGame: false, focus: ['Hamstrings'],
    instrDe: ['Stange hüftnah, Knie leicht gebeugt.', 'Hüfte nach hinten schieben bis die Oberschenkelrückseite spannt.', 'Mit Gesäß nach vorn aufrichten.'],
    mistakesDe: ['Rundrücken', 'Stange vom Körper weg', 'Zu tief gehen mit rundem Rücken'],
  },
  Single_Leg_Glute_Bridge: { nameDe: 'Einbeinige Glute Bridge', focus: ['Hamstrings'], legsLoad: 'niedrig', eccentricHeavy: false, ok2DaysBeforeGame: true },
  Monster_Walk: {
    nameDe: 'Monster Walks mit Band', category: 'Prävention', focus: ['Leiste', 'Knie'], legsLoad: 'niedrig', eccentricHeavy: false, ok2DaysBeforeGame: true,
    instrDe: ['Band über den Knien oder Knöcheln.', 'Halb in der Hocke, Schritte seitlich/diagonal, Spannung im Band halten.'],
    mistakesDe: ['Knie knicken nach innen', 'Schritte zu klein, Band entspannt'],
  },
  Worlds_Greatest_Stretch: { nameDe: "World's Greatest Stretch", category: 'Mobility', legsLoad: 'niedrig', eccentricHeavy: false, ok2DaysBeforeGame: true },
}

const mk = (e: Partial<LibExercise> & Pick<LibExercise, 'id' | 'nameEn' | 'nameDe' | 'category' | 'primary' | 'equipment'>): LibExercise => ({
  level: 'intermediate', secondary: [], images: [], legsLoad: 'niedrig', eccentricHeavy: false, ok2DaysBeforeGame: true,
  focus: [], needsBox: false, source: 'ergänzt', ...e,
})

/** Übungen aus dem Plan, die in der Datenbank fehlen */
const ADDED: LibExercise[] = [
  mk({
    id: 'nordic-hamstring-curl', nameEn: 'Nordic Hamstring Curl', nameDe: 'Nordic Hamstring Curl', category: 'Prävention',
    primary: ['hamstrings'], secondary: ['glutes', 'calves'], equipment: 'body only', legsLoad: 'mittel', eccentricHeavy: true,
    ok2DaysBeforeGame: false, focus: ['Hamstrings'],
    instrDe: [
      'Knie auf ein Polster, Partner oder Gerät fixiert die Fersen.',
      'Körper gestreckt von Knien bis Kopf, Hüfte bleibt offen.',
      'So langsam wie möglich nach vorn absenken, Hamstrings bremsen.',
      'Unten mit den Händen abfangen und mit minimaler Hilfe wieder hochdrücken.',
    ],
    mistakesDe: ['Hüfte knickt ein (Hohlkreuz/Pike)', 'Zu schnelles Fallen', 'Bei Schmerz weitermachen – lieber Stufe zurück'],
    ytQuery: 'Nordic Hamstring Curl Technik',
  }),
  mk({
    id: 'copenhagen-plank', nameEn: 'Copenhagen Plank', nameDe: 'Copenhagen Plank', category: 'Prävention',
    primary: ['adductors'], secondary: ['abdominals'], equipment: 'other', focus: ['Leiste'],
    instrDe: [
      'Seitstütz, Ellbogen unter der Schulter, oberes Bein auf der Bank.',
      'Kurzer Hebel: Knie liegt auf der Bank. Langer Hebel: Fuß/Knöchel auf der Bank.',
      'Hüfte anheben, unteres Bein frei, Körper bildet eine Linie.',
    ],
    mistakesDe: ['Hüfte hängt durch', 'Oberkörper dreht nach vorn', 'Zu früh auf langen Hebel'],
    ytQuery: 'Copenhagen Plank Technik',
  }),
  mk({
    id: 'trap-bar-jump', nameEn: 'Trap Bar Jump', nameDe: 'Trap-Bar-Sprünge', category: 'Schnellkraft/Plyometrie',
    primary: ['quadriceps', 'glutes'], secondary: ['hamstrings', 'calves'], equipment: 'other', legsLoad: 'mittel',
    ok2DaysBeforeGame: false,
    instrDe: ['Leichte Last (20–30 % 1RM) in der Trap Bar.', 'Aus dem Stand explosiv springen, Fuß streckt komplett.', 'Weich und leise landen, kurz zurücksetzen.'],
    mistakesDe: ['Zu schwer – Sprung wird langsam', 'Harte Landung', 'Knie fallen nach innen'],
  }),
  mk({
    id: 'iso-single-leg-bridge', nameEn: 'Isometric Single-Leg Bridge', nameDe: 'Isometrische Single-Leg-Bridge (Ferse auf Bank)',
    category: 'Prävention', primary: ['hamstrings', 'glutes'], equipment: 'other', focus: ['Hamstrings'],
    instrDe: ['Rücken auf dem Boden, eine Ferse auf der Bank.', 'Hüfte heben bis Schulter–Hüfte–Knie eine Linie bilden.', 'Position 20–30 s halten, Becken bleibt gerade.'],
    mistakesDe: ['Becken kippt zur Seite', 'Hohlkreuz statt Gesäß', 'Ferse rutscht'],
  }),
  mk({
    id: 'countermovement-jump', nameEn: 'Countermovement Jump', nameDe: 'Countermovement Jump (CMJ)', category: 'Schnellkraft/Plyometrie',
    primary: ['quadriceps', 'glutes', 'calves'], equipment: 'body only', legsLoad: 'mittel', ok2DaysBeforeGame: true,
    instrDe: ['Hände an der Hüfte oder Armschwung.', 'Schnell in die Hocke und sofort maximal hochspringen.', 'Weich landen, kurz Pause zwischen den Sprüngen.'],
    mistakesDe: ['Zu tiefe, langsame Hocke', 'Hartes Landen mit steifen Beinen'],
  }),
  mk({
    id: 'med-ball-rotationswurf', nameEn: 'Medicine Ball Rotational Throw', nameDe: 'Med-Ball-Rotationswurf an die Wand',
    category: 'Schnellkraft/Plyometrie', primary: ['abdominals', 'shoulders'], secondary: ['glutes'], equipment: 'medicine ball',
    instrDe: ['Seitlich zur Wand, Ball an der Hüfte.', 'Aus Beinen und Hüfte rotieren und den Ball explosiv an die Wand werfen.', 'Ball fangen und kontrolliert zurück.'],
    mistakesDe: ['Nur mit den Armen geworfen', 'Fußstand dreht nicht mit'],
  }),
  mk({
    id: 'bulgarian-split-squat', nameEn: 'Bulgarian Split Squat', nameDe: 'Bulgarian Split Squat', category: 'Kraft',
    primary: ['quadriceps', 'glutes'], secondary: ['hamstrings', 'adductors'], equipment: 'dumbbell', legsLoad: 'hoch',
    eccentricHeavy: true, ok2DaysBeforeGame: false, focus: ['Knie'],
    instrDe: ['Hinterer Fuß auf der Bank, vorderer Fuß ca. 1 m davor.', 'Gerade nach unten absenken bis der Oberschenkel waagerecht ist.', 'Über die ganze Fußsohle nach oben drücken.'],
    mistakesDe: ['Knie fällt nach innen', 'Zu nah an der Bank', 'Oberkörper kippt weit nach vorn'],
  }),
  mk({
    id: 'iso-hamstring-hold', nameEn: 'Isometric Hamstring Hold', nameDe: 'Isometrischer Hamstring-Hold (Ferse in Bank drücken)',
    category: 'Prävention', primary: ['hamstrings'], equipment: 'other', focus: ['Hamstrings'],
    instrDe: ['Rückenlage, Ferse auf der Bank, Knie leicht gebeugt.', 'Ferse aktiv in die Bank drücken, Hüfte leicht anheben.', '20–30 s mit gleichmäßiger Spannung halten.'],
    mistakesDe: ['Zu viel Schmerz – abbrechen', 'Hüfte sackt ab'],
  }),
  mk({
    id: 'hip-9090', nameEn: 'Hip 90/90 Mobility', nameDe: 'Hüfte 90/90', category: 'Mobility', primary: ['glutes', 'adductors'], equipment: 'body only',
    instrDe: ['Beide Knie im 90°-Winkel zur Seite ablegen.', 'Oberkörper aufrecht, zwischen den Seiten rotieren.'],
    mistakesDe: ['Rundrücken', 'Gesäß hebt ab'],
  }),
  mk({
    id: 'ankle-wall', nameEn: 'Wall Ankle Mobilization', nameDe: 'Sprunggelenk an der Wand', category: 'Mobility',
    primary: ['calves'], equipment: 'body only', focus: ['Sprunggelenk'],
    instrDe: ['Fuß ca. eine Handbreit von der Wand.', 'Knie zur Wand schieben, Ferse bleibt am Boden.'],
    mistakesDe: ['Ferse hebt ab', 'Knie fällt nach innen'],
  }),
  mk({
    id: 'band-hip-adduction-iso', nameEn: 'Side-lying Adductor Raise', nameDe: 'Seitliches Adduktoren-Heben', category: 'Prävention',
    primary: ['adductors'], equipment: 'body only', focus: ['Leiste'],
    instrDe: ['Seitlage, oberes Bein auf einer Bank/Stütze.', 'Unteres Bein anheben bis es das obere berührt, langsam senken.'],
    mistakesDe: ['Becken rollt nach hinten', 'Schwung'],
  }),
]

let cache: LibExercise[] | null = null

export function baseLibrary(): LibExercise[] {
  if (cache) return cache
  const added = new Map(ADDED.map((a) => [a.id, a]))
  const list: LibExercise[] = []
  for (const r of raw as unknown as RawEx[]) {
    const base = fromRaw(r)
    const o = OVERRIDES[r.id]
    list.push(o ? { ...base, ...o, source: 'free-exercise-db' } : base)
    added.delete(r.id)
  }
  for (const a of added.values()) list.push(a)
  cache = list
  return list
}

export const nameOf = (e: LibExercise): string => e.nameDe ?? e.nameEn

export const ytSearchUrl = (e: Pick<LibExercise, 'nameEn' | 'nameDe' | 'ytQuery'>): string =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(e.ytQuery ?? `${e.nameDe ?? e.nameEn} Übung Technik`)}`

/** Alternativen mit gleichen Zielmuskeln und gleicher Kategorie */
export function findAlternatives(
  ex: LibExercise,
  lib: LibExercise[],
  opts: { friday?: boolean; noEccentric?: boolean; limit?: number } = {},
): LibExercise[] {
  const eqNoBox = (l: LibExercise) => !l.needsBox
  const score = (l: LibExercise) => {
    const prim = l.primary.filter((m) => ex.primary.includes(m)).length
    const eq = l.equipment === ex.equipment ? 0.5 : 0
    return prim + eq
  }
  return lib
    .filter((l) => l.id !== ex.id && l.category === ex.category && eqNoBox(l))
    .filter((l) => l.primary.some((m) => ex.primary.includes(m)))
    .filter((l) => !(opts.friday && (l.eccentricHeavy || l.legsLoad === 'hoch')))
    .filter((l) => !(opts.noEccentric && l.eccentricHeavy))
    .filter((l) => l.images.length > 0 || l.source !== 'free-exercise-db')
    .sort((a, b) => score(b) - score(a))
    .slice(0, opts.limit ?? 8)
}
