import type { PanelTheme } from "./schema"

export const PANEL_THEME_PRESETS: Record<PanelTheme["preset"], {
  label: string
  base: string
  accent: string
}> = {
  brasa: { label: "Brasa", base: "#0d0c0b", accent: "#f0a154" },
  forno: { label: "Forno", base: "#fdf6e8", accent: "#a82e1a" },
  grao: { label: "Grão", base: "#faf5ec", accent: "#7a5c3d" },
  sal: { label: "Sal", base: "#fbfbfa", accent: "#5f5d57" },
  horta: { label: "Horta", base: "#f4faf3", accent: "#19703c" },
  neon: { label: "Neon", base: "#08080c", accent: "#16e0a3" },
  nori: { label: "Nori", base: "#f6f5f2", accent: "#a81f28" },
  confeito: { label: "Confeito", base: "#fff8fa", accent: "#b02a55" },
}

export const PANEL_SEGMENTS = [
  "Açaí", "Árabe", "Alta gastronomia", "Americano", "Bar", "Bistrô francês",
  "Boteco", "Brunch", "Buffet e rodízio", "Cachaçaria", "Cafeteria",
  "Cantina italiana", "Casa de massas", "Casa de sucos", "Casual dining", "Cevicheria",
  "Chinês", "Churrasco coreano", "Churrascaria", "Churros", "Comida mineira",
  "Comida nordestina", "Confeitaria", "Creperia", "Dark kitchen", "Doceria",
  "Fast-food", "Fit e saudável", "Food truck", "Gastrobar", "Gelateria",
  "Hamburgueria", "Halal", "Izakaya", "Indiano", "Japonês", "Kosher",
  "Mediterrâneo", "Mexicano", "Padaria artesanal", "Parrilla", "Pastelaria",
  "Peruano", "Pizzaria", "Poke", "Pub", "Restaurante de hotel",
  "Rotisserie", "Saladeria", "Self-service por quilo", "Sem glúten",
  "Sorveteria", "Steakhouse", "Tailandês", "Tapiocaria", "Vegano",
  "Vegetariano", "Vietnamita", "Wine bar",
] as const

export const PANEL_UF_CODES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
] as const

const segmentTheme: Record<string, PanelTheme["preset"]> = {
  Hamburgueria: "brasa", Churrascaria: "brasa", Steakhouse: "brasa", Parrilla: "brasa",
  Americano: "brasa", "Churrasco coreano": "brasa", "Fast-food": "brasa", "Food truck": "brasa", "Dark kitchen": "brasa",
  Pizzaria: "forno", "Cantina italiana": "forno", "Casa de massas": "forno", "Comida mineira": "forno",
  "Comida nordestina": "forno", Pastelaria: "forno", Tapiocaria: "forno", Rotisserie: "forno",
  "Self-service por quilo": "forno", "Buffet e rodízio": "forno", "Casual dining": "forno", Mexicano: "forno", Árabe: "forno", Indiano: "forno",
  Cafeteria: "grao", "Padaria artesanal": "grao", Creperia: "grao", Brunch: "grao", "Restaurante de hotel": "grao",
  "Alta gastronomia": "sal", "Bistrô francês": "sal", "Wine bar": "sal", Mediterrâneo: "sal", Peruano: "sal", Cevicheria: "sal",
  "Açaí": "horta", Saladeria: "horta", "Casa de sucos": "horta", Vegetariano: "horta", Vegano: "horta", "Fit e saudável": "horta", "Sem glúten": "horta", Poke: "horta", Kosher: "horta", Halal: "horta",
  Bar: "neon", Boteco: "neon", Pub: "neon", Gastrobar: "neon", Cachaçaria: "neon", Izakaya: "neon",
  Japonês: "nori", Chinês: "nori", Tailandês: "nori", Coreano: "nori", Vietnamita: "nori",
  Doceria: "confeito", Confeitaria: "confeito", Sorveteria: "confeito", Gelateria: "confeito", Churros: "confeito",
}

export function suggestPanelTheme(segment: string | null): PanelTheme["preset"] | null {
  return segment ? segmentTheme[segment] ?? null : null
}

