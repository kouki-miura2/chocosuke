/**
 * The 12 schedule colors (docs/spec.md "予定 > 項目 > 色"). The DB stores only the key; white text
 * must stay readable on every color (event bars).
 */
export const SCHEDULE_COLORS = [
  { key: 'blue', label: '青', value: '#2F6FD0' },
  { key: 'sky', label: '水色', value: '#0277BD' },
  { key: 'teal', label: '青緑', value: '#00796B' },
  { key: 'green', label: '緑', value: '#2E8A57' },
  { key: 'olive', label: 'オリーブ', value: '#6B7F1A' },
  { key: 'orange', label: 'オレンジ', value: '#B86E00' },
  { key: 'red', label: '赤', value: '#C62828' },
  { key: 'pink', label: 'ピンク', value: '#C9476F' },
  { key: 'purple', label: '紫', value: '#7B4FC4' },
  { key: 'indigo', label: '藍', value: '#3F51B5' },
  { key: 'brown', label: '茶', value: '#795548' },
  { key: 'gray', label: 'グレー', value: '#5F6368' },
] as const

const byKey = new Map<string, string>(SCHEDULE_COLORS.map((color) => [color.key, color.value]))

/** The color of a schedule color key; gray for an unknown key. */
export const scheduleColor = (key: string): string => byKey.get(key) ?? '#5F6368'
